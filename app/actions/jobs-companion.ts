"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { followUpFrom, type GuideApp } from "@/lib/jobs-companion";
import { createClient } from "@/lib/supabase/server";

export type CompanionResult = { ok: boolean; error?: string; from?: string };

async function requireUser(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

/** Raw database text is never shown; known, friendly messages from our own functions are. */
function friendly(message?: string): string {
  if (!message) return "failed";
  if (/violates|constraint|schema cache|function public\.|duplicate key|does not exist/i.test(message)) return "failed";
  return message;
}

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const basicSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.preprocess(empty, z.string().trim().min(7).max(20).nullable()),
  contact_email: z.preprocess(empty, z.email().max(120).nullable()),
  desired_roles: z.preprocess(empty, z.string().trim().max(200).nullable()),
  region_code: z.preprocess(empty, z.string().max(40).nullable()),
  province_code: z.preprocess(empty, z.string().max(40).nullable()),
  city_code: z.preprocess(empty, z.string().max(40).nullable()),
});

/**
 * "Apply Now" step 1: saves ONLY the basic details (name, contact, wanted job, location) and the sharing consent.
 * Anything already in the full profile (skills, work history, documents ...) is left exactly as it was.
 */
export async function saveBasicJobProfile(fd: FormData): Promise<CompanionResult> {
  const next = String(fd.get("next") ?? "/jobs");
  const { supabase, userId } = await requireUser(next.startsWith("/jobs") ? next : "/jobs");
  const p = basicSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "invalid" };
  if (!p.data.phone && !p.data.contact_email) return { ok: false, error: "contact" };
  if (fd.get("consent") !== "on") return { ok: false, error: "consent" };
  const { data: existing } = await supabase.from("job_profiles").select("consent_at").eq("user_id", userId).maybeSingle();
  // Upsert with only these columns: on an existing profile, the other columns are not touched.
  const { error } = await supabase.from("job_profiles").upsert({ user_id: userId, ...p.data, consent_at: existing?.consent_at ?? new Date().toISOString() });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/jobs", "layout");
  return { ok: true };
}

/** "Follow-up": a polite message to the employer in the application's chat, at most once every few days. */
export async function sendFollowUp(appId: string, body: string): Promise<CompanionResult> {
  const p = z.object({ id: z.uuid(), body: z.string().trim().min(10).max(1000) }).safeParse({ id: appId, body });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser("/jobs/applications");
  // reapplied_at comes from migration 20261125000008 (not yet in the generated types).
  const { data: app } = await (supabase as unknown as SupabaseClient).from("job_applications").select("id, status, created_at, updated_at, reapplied_at").eq("id", p.data.id).eq("applicant_id", userId).maybeSingle();
  if (!app) return { ok: false, error: "not_found" };
  const { data: threadId, error: te } = await supabase.rpc("open_job_thread", { p_app: app.id });
  if (te || !threadId) return { ok: false, error: "failed" };
  const { data: last } = await supabase.from("job_messages").select("created_at").eq("thread_id", threadId).eq("sender_id", userId).eq("is_system", false)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const from = followUpFrom(app as GuideApp, last?.created_at ?? null);
  if (!from) return { ok: false, error: "status" };
  if (from.getTime() > Date.now()) return { ok: false, error: "too_soon", from: from.toISOString() };
  const { error } = await supabase.from("job_messages").insert({ thread_id: threadId, sender_id: userId, body: p.data.body });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/jobs/applications");
  revalidatePath("/jobs/messages", "layout");
  return { ok: true };
}

/** "Re-Apply": sends a withdrawn (or, after 14 days, a not-selected) application again. The database checks every rule. */
export async function reapplyToJob(appId: string, note: string): Promise<CompanionResult> {
  const p = z.object({ id: z.uuid(), note: z.string().max(1000) }).safeParse({ id: appId, note });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await requireUser("/jobs/applications");
  // reapply_to_job is added by migration 20261125000008 (not yet in the generated types).
  const { error } = await (supabase as unknown as SupabaseClient).rpc("reapply_to_job", { p_app: p.data.id, p_note: p.data.note });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/jobs/applications");
  revalidatePath("/jobs", "layout");
  return { ok: true };
}
