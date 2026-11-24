"use server";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { isOn } from "@/lib/flags";
import { ATTR_COOKIE, ATTR_DAYS, attributionFrom, decodeAttr, encodeAttr } from "@/lib/jobs-attribution";
import { JOB_EVENTS, type JobEvent, type JobEventProps } from "@/lib/jobs-events";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, JOB_CATEGORIES } from "@/lib/jobs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "mph_jobs_sid";
const cookieOpts = (days: number) => ({ path: "/", maxAge: days * 86_400, sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" });

/** A random per-browser id for joining funnel steps. It is not tied to a person and holds no personal data. */
async function sessionId() {
  const jar = await cookies();
  let sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid || !/^[A-Za-z0-9_-]{16,64}$/.test(sid)) {
    sid = randomBytes(18).toString("base64url");
    jar.set(SESSION_COOKIE, sid, cookieOpts(180));
  }
  return sid;
}

/** Records one allow-listed funnel event. Never throws: analytics must not break the page. Off unless jobs2_landing. */
export async function recordJobEvent(name: JobEvent, props: JobEventProps = {}): Promise<void> {
  if (!isOn("jobs2_landing") || !(JOB_EVENTS as readonly string[]).includes(name)) return;
  try {
    const sid = await sessionId();
    const attr = decodeAttr((await cookies()).get(ATTR_COOKIE)?.value);
    const supabase = (await createClient()) as unknown as SupabaseClient; // new RPC, not yet in generated types
    await supabase.rpc("record_job_event", { p_name: name, p_session: sid, p_props: props, p_attr: attr });
  } catch {
    /* ignore */
  }
}

/**
 * First-touch attribution from the landing URL (UTM fields + opaque chapter code `ch`). Kept in a first-party
 * cookie for 30 days, so it survives signing up and logging in. Malformed or personal values are dropped.
 */
export async function captureAttribution(search: string): Promise<void> {
  if (!isOn("jobs2_landing")) return;
  const attr = attributionFrom(new URLSearchParams(search.slice(0, 600)));
  if (!Object.keys(attr).length) return;
  const jar = await cookies();
  if (jar.get(ATTR_COOKIE)?.value) return; // first touch wins
  jar.set(ATTR_COOKIE, encodeAttr(attr), cookieOpts(ATTR_DAYS));
  await recordJobEvent("referral_attribution", { source: "jobs_landing" });
}

export type AlertState = { ok?: boolean; error?: "signin" | "invalid" | "limit" | "failed" } | undefined;

/** "Notify me": saves the search for a signed-in member (max 10). Search text is stored only in their own row. */
export async function saveJobAlert(_prev: AlertState, fd: FormData): Promise<AlertState> {
  if (!isOn("jobs2_landing")) return { error: "failed" };
  const p = z
    .object({
      q: z.string().trim().max(80).optional(),
      loc: z.string().trim().max(60).optional(),
      category: z.enum(JOB_CATEGORIES).or(z.literal("")).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "invalid" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return { error: "signin" };
  const row = { user_id: userId, q: p.data.q || null, location: p.data.loc || null, category: p.data.category || null };
  const { error } = await (supabase as unknown as SupabaseClient).from("job_search_alerts").upsert(row, { onConflict: "user_id,q,location,category", ignoreDuplicates: true });
  if (error) return { error: /row-level security|policy/i.test(error.message) ? "limit" : "failed" };
  return { ok: true };
}

/* ───────────── P4: profile wizard autosave (flag jobs2_profile_wizard) ───────────── */
const opt = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().optional());
const code = opt(40);
const STEP_SCHEMAS = {
  1: z.object({
    full_name: z.string().trim().min(2).max(80),
    desired_roles: opt(200), phone: opt(20), contact_email: z.preprocess((v) => (v === "" ? null : v), z.email().max(120).nullable().optional()),
    region_code: code, province_code: code, city_code: code,
    job_types: z.array(z.enum(EMPLOYMENT_TYPES)).max(6).optional(),
    open_to_work: z.boolean().optional(),
  }),
  2: z.object({ skills: z.array(z.string().trim().min(1).max(40)).max(20), education_level: z.enum(EDUCATION_LEVELS).nullable().optional() }),
  3: z.object({
    experience_years: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(0).max(60).nullable()),
    work_history: z.array(z.object({ company: z.string().trim().max(80), role: z.string().trim().max(80), from: z.string().trim().max(10), to: z.string().trim().max(10), notes: z.string().trim().max(300) })).max(3),
  }),
  4: z.object({ headline: opt(100), about: opt(1500), accurate: z.literal(true) }),
  5: z.object({ consent: z.literal(true) }),
} as const;
export type WizardStep = keyof typeof STEP_SCHEMAS;
export type StepResult = { ok: boolean; error?: "invalid" | "accurate" | "consent" | "signin" | "failed" | "off"; savedAt?: string };

/** Saves only the fields of one wizard step on the existing job_profiles row (created on first save). */
export async function saveProfileStep(step: WizardStep, input: Record<string, unknown>): Promise<StepResult> {
  if (!isOn("jobs2_profile_wizard")) return { ok: false, error: "off" };
  const schema = STEP_SCHEMAS[step];
  if (!schema) return { ok: false, error: "invalid" };
  const p = schema.safeParse(input);
  if (!p.success) {
    if (step === 4 && input.accurate !== true) return { ok: false, error: "accurate" };
    if (step === 5) return { ok: false, error: "consent" };
    return { ok: false, error: "invalid" };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { ok: false, error: "signin" };

  const { accurate: _a, consent: _c, ...fields } = p.data as Record<string, unknown>;
  void _a; void _c;
  const row: Record<string, unknown> = { ...fields };
  if (step === 3) row.work_history = (fields.work_history as { company: string; role: string }[]).filter((h) => h.company || h.role);
  const { data: existing } = await supabase.from("job_profiles").select("user_id, consent_at").eq("user_id", userId).maybeSingle();
  if (step === 5) row.consent_at = existing?.consent_at ?? new Date().toISOString();
  let error;
  if (existing) ({ error } = await supabase.from("job_profiles").update(row as never).eq("user_id", userId));
  else {
    const { data: me } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const full_name = (row.full_name as string | undefined) ?? (me?.display_name && me.display_name.length >= 2 ? me.display_name : null);
    if (!full_name) return { ok: false, error: "invalid" };
    ({ error } = await supabase.from("job_profiles").insert({ ...row, user_id: userId, full_name } as never));
  }
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/jobs/start");
  await recordJobEvent("profile_step_complete");
  return { ok: true, savedAt: new Date().toISOString() };
}
