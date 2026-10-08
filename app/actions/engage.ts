"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { REPORT_REASONS } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string; saved?: boolean };

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

export async function toggleFavorite(target: { listingId?: string; storeId?: string }): Promise<ActionResult> {
  const parsed = z
    .object({ listingId: z.uuid().optional(), storeId: z.uuid().optional() })
    .refine((v) => !!v.listingId !== !!v.storeId)
    .safeParse(target);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "auth" };

  const col = parsed.data.listingId ? "listing_id" : "store_id";
  const id = (parsed.data.listingId ?? parsed.data.storeId)!;
  const { data: existing } = await supabase.from("favorites").select("id").eq("user_id", userId).eq(col, id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
    return error ? { ok: false, error: "failed" } : { ok: true, saved: false };
  }
  const { error } = await supabase
    .from("favorites")
    .insert(parsed.data.listingId ? { user_id: userId, listing_id: id } : { user_id: userId, store_id: id });
  return error ? { ok: false, error: "failed" } : { ok: true, saved: true };
}

/** Opens (or reuses) a chat between the signed-in buyer and a store, then goes to it. */
export async function startConversation(storeId: string, listingId: string | null) {
  if (!z.uuid().safeParse(storeId).success || (listingId && !z.uuid().safeParse(listingId).success)) redirect("/");
  const { supabase, userId } = await currentUserId();
  const back = listingId ? `/listing/${listingId}` : "";
  if (!userId) redirect(`/login?next=${encodeURIComponent(back || "/")}`);

  const find = () => {
    let q = supabase.from("conversations").select("id").eq("buyer_id", userId).eq("store_id", storeId);
    q = listingId ? q.eq("listing_id", listingId) : q.is("listing_id", null);
    return q.maybeSingle();
  };
  let { data: convo } = await find();
  if (!convo) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ buyer_id: userId, store_id: storeId, listing_id: listingId })
      .select("id")
      .single();
    if (error) convo = (await find()).data; // lost a race, or RLS blocked (own store)
    else convo = data;
  }
  if (!convo) redirect(back || "/");
  redirect(`/messages/${convo.id}`);
}

const reportSchema = z.object({
  targetType: z.enum(["listing", "store", "user", "message"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
  evidence: z.array(z.object({ path: z.string().min(3).max(300), note: z.string().max(300).optional() })).max(5).optional(),
});

/** Private report intake. Nothing here is published; admins review it (Phase 2 adds due process + public flags). */
export async function submitReport(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, error: "auth" };
  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: userId,
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    })
    .select("id")
    .single();
  if (error || !report) {
    const m = error?.message ?? "";
    return { ok: false, error: m.includes("limit") ? "limit" : m.includes("already have") ? "duplicate" : m.includes("yourself") ? "self" : "failed" };
  }
  // evidence must live in the reporter's own folder of the private bucket
  const files = (parsed.data.evidence ?? []).filter((e) => e.path.startsWith(`${userId}/`));
  if (files.length) {
    await supabase.from("report_evidence").insert(files.map((e) => ({ report_id: report.id, uploader_id: userId, storage_path: e.path, note: e.note ?? null })));
  }
  return { ok: true };
}
