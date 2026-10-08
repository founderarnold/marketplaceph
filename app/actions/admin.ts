"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Every admin write goes through RLS (is_admin()) and is recorded in audit_logs by DB triggers. */
async function adminClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) redirect("/login?next=/admin");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (!me || (me.role !== "admin" && me.role !== "moderator")) redirect("/");
  return { supabase, id, role: me.role };
}

export async function setListingStatus(listingId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const status = z.enum(["active", "hidden", "removed"]).parse(fd.get("status"));
  await supabase.from("listings").update({ status }).eq("id", z.uuid().parse(listingId));
  revalidateTag("listings", "max");
  revalidatePath("/admin");
}

export async function setStoreVerification(storeId: string, fd: FormData) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  const level = z.coerce.number().int().min(0).max(3).parse(fd.get("level"));
  await supabase.from("stores").update({ verification_level: level }).eq("id", z.uuid().parse(storeId));
  revalidatePath("/admin");
}

export async function setUserRole(userId: string, fd: FormData) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  const next = z.enum(["user", "moderator", "admin"]).parse(fd.get("role"));
  await supabase.from("profiles").update({ role: next }).eq("id", z.uuid().parse(userId));
  revalidatePath("/admin");
}

export async function addCategory(fd: FormData) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  const parsed = z
    .object({
      slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
      name_en: z.string().trim().min(2).max(60),
      name_fil: z.string().trim().min(2).max(60),
    })
    .parse(Object.fromEntries(fd));
  await supabase.from("categories").insert({ ...parsed, sort_order: 100 });
  revalidateTag("categories", "max");
  revalidatePath("/admin");
}

export async function toggleCategory(categoryId: string, active: boolean) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  await supabase.from("categories").update({ is_active: active }).eq("id", z.uuid().parse(categoryId));
  revalidateTag("categories", "max");
  revalidatePath("/admin");
}

export async function addBannedKeyword(fd: FormData) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  const parsed = z.object({ keyword: z.string().trim().min(3).max(60), reason: z.string().trim().min(3).max(200) }).parse(Object.fromEntries(fd));
  await supabase.from("banned_keywords").insert(parsed);
  revalidatePath("/admin");
}

export async function removeBannedKeyword(id: string) {
  const { supabase, role } = await adminClient();
  if (role !== "admin") return;
  await supabase.from("banned_keywords").delete().eq("id", z.uuid().parse(id));
  revalidatePath("/admin");
}

// ───────── Cases (report → notice → response → decision → appeal) ─────────
// All state changes go through SECURITY DEFINER functions that enforce the due-process rules in the database.
/** Runs an RPC; on failure sends the admin back to the tab with the database's own (human-readable) message. */
async function rpcOrLog(label: string, tab: string, p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) {
    console.error(label, error.message);
    redirect(`/admin?tab=${tab}&err=${encodeURIComponent(error.message.slice(0, 200))}`);
  }
  revalidatePath("/admin");
}

export async function openCase(reportId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const days = z.coerce.number().int().min(3).max(30).parse(fd.get("days") ?? 7);
  await rpcOrLog("open_case", "cases", supabase.rpc("open_case", { p_report: z.uuid().parse(reportId), p_days: days }));
}

export async function decideCase(reportId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const outcome = z.enum(["dismissed", "warning", "restricted", "flagged"]).parse(fd.get("outcome"));
  const note = z.string().trim().max(1000).parse(fd.get("note") ?? "");
  const restrictDays = z.coerce.number().int().min(1).max(90).catch(7).parse(fd.get("restrict_days"));
  const gcash = z.string().trim().max(80).parse(fd.get("gcash_name") ?? "");
  const months = z.coerce.number().int().min(1).max(36).catch(12).parse(fd.get("flag_months"));
  await rpcOrLog(
    "decide_case",
    "cases",
    supabase.rpc("decide_case", {
      p_report: z.uuid().parse(reportId), p_outcome: outcome, p_note: note,
      p_restrict_days: restrictDays, p_gcash_name: gcash || undefined, p_flag_months: months,
    }),
  );
}

export async function setEvidenceShareable(evidenceId: string, shareable: boolean) {
  const { supabase } = await adminClient();
  await rpcOrLog("set_evidence_shareable", "cases", supabase.rpc("set_evidence_shareable", { p_evidence: z.uuid().parse(evidenceId), p_shareable: shareable }));
}

export async function decideAppeal(appealId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const outcome = z.enum(["upheld", "overturned"]).parse(fd.get("outcome"));
  const note = z.string().trim().max(1000).parse(fd.get("note") ?? "");
  await rpcOrLog("decide_appeal", "appeals", supabase.rpc("decide_appeal", { p_appeal: z.uuid().parse(appealId), p_outcome: outcome, p_note: note }));
}

// ───────── Disputes (order mediation) ─────────
export async function resolveDispute(disputeId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const outcome = z.enum(["buyer_favored", "seller_favored", "partial", "no_fault"]).parse(fd.get("outcome"));
  const note = z.string().trim().max(1000).parse(fd.get("note") ?? "");
  const result = z.enum(["completed", "cancelled"]).optional().catch(undefined).parse(fd.get("result") || undefined);
  await rpcOrLog("resolve_dispute", "disputes", supabase.rpc("resolve_dispute", { p_dispute: z.uuid().parse(disputeId), p_outcome: outcome, p_note: note, p_result: result }));
}

/** Admin-only: open a payment proof / packing photo / waybill / dispute file. Logged first, then a 60-second signed URL. */
export async function getAdminOrderFileUrl(kind: "payment" | "packing" | "evidence" | "waybill", id: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(id).success) return { error: "invalid" };
  try {
    const { supabase, id: adminId } = await adminClient();
    let path: string | null | undefined;
    if (kind === "payment") path = (await supabase.from("payment_proofs").select("proof_path").eq("id", id).maybeSingle()).data?.proof_path;
    else if (kind === "packing") path = (await supabase.from("packing_proofs").select("photo_path").eq("id", id).maybeSingle()).data?.photo_path;
    else if (kind === "evidence") path = (await supabase.from("dispute_evidence").select("storage_path").eq("id", id).maybeSingle()).data?.storage_path;
    else path = (await supabase.from("shipments").select("waybill_path").eq("order_id", id).maybeSingle()).data?.waybill_path;
    if (!path) return { error: "not_found" };
    const { error: logErr } = await supabase.from("document_access_logs").insert({ admin_id: adminId, kind: "order_file", document_id: id });
    if (logErr) return { error: "log_failed" };
    const { data, error } = await createAdminClient().storage.from("order-files").createSignedUrl(path, 60);
    return error || !data ? { error: "sign_failed" } : { url: data.signedUrl };
  } catch {
    return { error: "forbidden" };
  }
}

// ───────── Plans (FLAME tiers) ─────────
// No payment provider is connected yet, so admins grant a tier by hand (and every change is audit-logged by the database).
export async function grantPlan(userId: string, fd: FormData) {
  const { supabase } = await adminClient();
  const days = z.coerce.number().int().min(1).max(3650).optional().catch(undefined).parse(fd.get("days") || undefined);
  const note = z.string().trim().max(300).parse(fd.get("note") ?? "");
  const tier = z.enum(["starter", "micro", "neo", "pro", "champion"]).parse(fd.get("tier"));
  const billing = z.enum(["monthly", "yearly"]).catch("monthly").parse(fd.get("billing") ?? "monthly");
  await rpcOrLog("admin_set_plan", "plans", supabase.rpc("admin_set_plan", { p_user: z.uuid().parse(userId), p_active: true, p_days: days, p_note: note || undefined, p_tier: tier, p_billing: billing }));
}

export async function revokePlan(userId: string) {
  const { supabase } = await adminClient();
  await rpcOrLog("admin_set_plan", "plans", supabase.rpc("admin_set_plan", { p_user: z.uuid().parse(userId), p_active: false }));
}

/** Runs the daily reminder job immediately (the same function the cron route calls). */
export async function runRemindersNow() {
  await adminClient();
  const { data, error } = await createAdminClient().rpc("run_due_reminders");
  if (error) redirect(`/admin?tab=plans&err=${encodeURIComponent(error.message.slice(0, 200))}`);
  const r = data?.[0];
  redirect(`/admin?tab=plans&err=${encodeURIComponent(`Reminders run: ${r?.self_sent ?? 0} personal, ${r?.follow_ups_sent ?? 0} follow-ups, ${r?.sms_queued ?? 0} SMS queued`)}`);
}
