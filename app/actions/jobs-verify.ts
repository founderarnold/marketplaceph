"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PRO_BADGE, PRO_PARTNER_KINDS, PRO_RESULTS } from "@/lib/jobs-verify";

/* Verified Professional Account. Every rule (complete documents, one pending request, full admins only, a passed
   face-to-face interview before approval) is enforced by the database (20261125000009); these only validate input. */

export type R = { ok: boolean; error?: string };

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase: supabase as unknown as SupabaseClient, userId: (data?.claims?.sub as string | undefined) ?? null };
}
function fail(e: { message?: string; code?: string } | null): R {
  const m = e?.message ?? "";
  console.error("jobs-verify action failed:", e?.code ?? "", m);
  if (e?.code === "23505") return { ok: false, error: "already_pending" };
  if (/violates|constraint|permission denied|row-level|schema cache|function public\.|JWT/i.test(m) || !m) return { ok: false, error: "failed" };
  return { ok: false, error: m };
}

/** Applicant: "Submit Request for Account Verification". */
export async function requestProVerification(note: string): Promise<R> {
  const p = z.string().trim().max(1000).safeParse(note);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("badge_requests").insert({ user_id: userId, badge: PRO_BADGE, note: p.data || null });
  revalidatePath("/jobs/profile");
  return error ? fail(error) : { ok: true };
}

const interviewSchema = z.object({
  requestId: z.uuid(),
  partnerName: z.string().trim().min(2).max(120),
  partnerKind: z.enum(PRO_PARTNER_KINDS),
  partnerRef: z.string().trim().max(80),
  date: z.iso.date(),
  place: z.string().trim().max(160),
  result: z.enum(PRO_RESULTS),
  notes: z.string().trim().max(1000),
});

/** Admin: record the face-to-face interview done by an appointed or accredited FLAME PH partner. */
export async function recordProInterview(input: z.input<typeof interviewSchema>): Promise<R> {
  const p = interviewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const d = p.data;
  const { error } = await supabase.rpc("record_pro_interview", {
    p_request: d.requestId, p_partner_name: d.partnerName, p_partner_kind: d.partnerKind, p_partner_ref: d.partnerRef,
    p_date: d.date, p_place: d.place, p_result: d.result, p_notes: d.notes,
  });
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}

/** Admin: grant (needs a passed interview) or turn down a request. */
export async function decideProRequest(requestId: string, approve: boolean, note: string): Promise<R> {
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("review_badge_request", { p_id: requestId, p_approve: approve, p_note: note.trim().slice(0, 500) || null });
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}
