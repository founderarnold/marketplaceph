"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const docTypes = ["gov_id", "selfie_with_id", "dti", "sec", "cda", "bir_cor", "mayors_permit", "fda", "other"] as const;

const submitSchema = z.object({
  storeId: z.uuid(),
  target: z.union([z.literal(2), z.literal(3)]),
  docs: z.array(z.object({ type: z.enum(docTypes), path: z.string().min(3).max(300) })).min(1).max(8),
});

export async function submitVerification(input: z.input<typeof submitSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_verification", {
    p_store: parsed.data.storeId,
    p_target: parsed.data.target,
    p_docs: parsed.data.docs,
  });
  if (error) {
    console.error("submitVerification", error.message);
    // our own validation messages are safe and useful to show
    return { ok: false, error: /needs|Get ID|Already|Attach|Invalid|Not your/i.test(error.message) ? error.message : "failed" };
  }
  revalidatePath("/sell/verify");
  return { ok: true };
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("auth");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (me?.role !== "admin" && me?.role !== "moderator") throw new Error("forbidden");
  return { supabase, id };
}

/**
 * The ONLY way to open a private document. Admin-only; every call writes an access-log row first,
 * then returns a signed URL that expires in 60 seconds.
 */
export async function getSignedDocUrl(kind: "verification" | "evidence", docId: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(docId).success) return { error: "invalid" };
  try {
    const { supabase, id } = await requireAdmin();
    const bucket = kind === "verification" ? "private-docs" : "evidence";
    const { data: doc } =
      kind === "verification"
        ? await supabase.from("verification_documents").select("storage_path").eq("id", docId).maybeSingle()
        : await supabase.from("report_evidence").select("storage_path").eq("id", docId).maybeSingle();
    if (!doc) return { error: "not_found" };
    const { error: logErr } = await supabase.from("document_access_logs").insert({ admin_id: id, kind, document_id: docId });
    if (logErr) return { error: "log_failed" }; // never hand out a URL we could not log
    const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(doc.storage_path, 60);
    return error || !data ? { error: "sign_failed" } : { url: data.signedUrl };
  } catch {
    return { error: "forbidden" };
  }
}

/** Accused users may open only evidence an admin marked shareable (checked by a DB function). */
export async function getSharedEvidenceUrl(reportId: string, evidenceId: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(reportId).success || !z.uuid().safeParse(evidenceId).success) return { error: "invalid" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("evidence_shared_with_me", { p_report: reportId });
  const item = data?.find((e) => e.id === evidenceId);
  if (!item) return { error: "forbidden" };
  const signed = await createAdminClient().storage.from("evidence").createSignedUrl(item.storage_path, 60);
  return signed.error || !signed.data ? { error: "sign_failed" } : { url: signed.data.signedUrl };
}

export async function reviewVerification(verificationId: string, fd: FormData) {
  const { supabase } = await requireAdmin();
  const decision = z.enum(["approved", "rejected", "needs_more"]).parse(fd.get("decision"));
  const note = z.string().trim().max(1000).parse(fd.get("note") ?? "");
  const { error } = await supabase.rpc("review_verification", { p_id: z.uuid().parse(verificationId), p_decision: decision, p_note: note });
  if (error) redirect(`/admin?tab=verification&err=${encodeURIComponent(error.message.slice(0, 200))}`);
  revalidatePath("/admin");
}

/** Deletes documents whose retention date has passed (files first, then rows). */
export async function purgeExpiredDocuments() {
  const { supabase } = await requireAdmin();
  const { data: docs } = await supabase.from("verification_documents").select("id, storage_path").lt("retain_until", new Date().toISOString());
  if (docs?.length) {
    const svc = createAdminClient();
    await svc.storage.from("private-docs").remove(docs.map((d) => d.storage_path));
    await svc.from("verification_documents").delete().in("id", docs.map((d) => d.id));
  }
  revalidatePath("/admin");
}
