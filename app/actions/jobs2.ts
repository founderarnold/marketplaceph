"use server";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { isOn } from "@/lib/flags";
import { ATTR_COOKIE, ATTR_DAYS, attributionFrom, decodeAttr, encodeAttr } from "@/lib/jobs-attribution";
import { JOB_EVENTS, type JobEvent, type JobEventProps } from "@/lib/jobs-events";
import { JOB_CATEGORIES } from "@/lib/jobs";
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
