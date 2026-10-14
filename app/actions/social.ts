"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { BADGES } from "@/lib/social";

/* Suki friends, public updates, Q&A comments, job reviews and badge requests.
   Every rule (who may do what, daily limits, banned words) is enforced by the database; these only validate input. */

export type R = { ok: boolean; error?: string };

const uuid = z.uuid();
async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
/** Database guard messages are written for people ("Daily comment limit reached"); internals are not. */
function fail(e: { message?: string } | null): R {
  const m = e?.message ?? "";
  if (/violates|constraint|permission denied|row-level|schema cache|function public\.|JWT/i.test(m) || !m) return { ok: false, error: "failed" };
  return { ok: false, error: m };
}

/* ───────── Friends ───────── */
export async function setFriend(targetUserId: string, add: boolean): Promise<R> {
  if (!uuid.safeParse(targetUserId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  if (userId === targetUserId) return { ok: false, error: "self" };
  const { error } = add
    ? await supabase.from("follows").upsert({ follower_id: userId, followee_id: targetUserId }, { onConflict: "follower_id,followee_id", ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("follower_id", userId).eq("followee_id", targetUserId);
  revalidatePath("/updates");
  return error ? fail(error) : { ok: true };
}

/* ───────── Public updates ───────── */
export async function postUpdate(body: string, link: string | null): Promise<R> {
  const p = z.object({ body: z.string().trim().min(2).max(1000), link: z.string().regex(/^(listing|job):[0-9a-f-]{36}$/).nullable() }).safeParse({ body, link });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const [kind, id] = p.data.link ? p.data.link.split(":") : [null, null];
  const { error } = await supabase.from("user_updates").insert({
    author_id: userId,
    body: p.data.body,
    listing_id: kind === "listing" ? id : null,
    job_id: kind === "job" ? id : null,
  });
  revalidatePath("/updates");
  return error ? fail(error) : { ok: true };
}

export async function deleteUpdate(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("user_updates").delete().eq("id", id);
  revalidatePath("/updates");
  return error ? fail(error) : { ok: true };
}

/* ───────── Q&A comments ───────── */
export async function addComment(kind: "listing" | "job", targetId: string, body: string): Promise<R> {
  const p = z.object({ kind: z.enum(["listing", "job"]), id: uuid, body: z.string().trim().min(2).max(1000) }).safeParse({ kind, id: targetId, body });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("comments").insert({ target_kind: p.data.kind, target_id: p.data.id, author_id: userId, body: p.data.body });
  revalidatePath(p.data.kind === "listing" ? `/listing/${p.data.id}` : `/jobs/${p.data.id}`);
  return error ? fail(error) : { ok: true };
}

export async function deleteComment(id: string, path: string): Promise<R> {
  if (!uuid.safeParse(id).success || !/^\/(listing|jobs)\/[0-9a-f-]{36}$/.test(path)) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("comments").delete().eq("id", id);
  revalidatePath(path);
  return error ? fail(error) : { ok: true };
}

/* ───────── Reviews after a hiring ───────── */
export async function reviewHiring(applicationId: string, rating: number, comment: string): Promise<R> {
  const p = z.object({ id: uuid, rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000) }).safeParse({ id: applicationId, rating, comment });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("job_reviews").insert({ application_id: p.data.id, reviewer_id: userId, rating: p.data.rating, comment: p.data.comment || null });
  if (error?.code === "23505") return { ok: false, error: "already_reviewed" };
  revalidatePath("/jobs/applications");
  revalidatePath("/jobs/employer");
  return error ? fail(error) : { ok: true };
}

/* ───────── Badges ───────── */
export async function requestBadge(badge: string, note: string): Promise<R> {
  const p = z.object({ badge: z.enum(BADGES), note: z.string().trim().max(1000) }).safeParse({ badge, note });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("badge_requests").insert({ user_id: userId, badge: p.data.badge, note: p.data.note || null });
  if (error?.code === "23505") return { ok: false, error: "already_pending" };
  revalidatePath("/account/badges");
  return error ? fail(error) : { ok: true };
}

/* ───────── Admin / founder / webmaster ───────── */
export async function decideBadge(requestId: string, approve: boolean, note: string): Promise<R> {
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("review_badge_request", { p_id: requestId, p_approve: approve, p_note: note.slice(0, 500) || undefined });
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}

export async function removeBadge(userId: string, badge: string): Promise<R> {
  const p = z.object({ u: uuid, b: z.enum(BADGES) }).safeParse({ u: userId, b: badge });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("revoke_badge", { p_user: p.data.u, p_badge: p.data.b });
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}

/** Pin someone to the top of a Featured row, found by account email or user id. */
export async function pinFeatured(who: string, kind: string, days: number | null): Promise<R> {
  const p = z.object({ who: z.string().trim().min(3).max(200), kind: z.enum(["seller", "buyer", "applicant", "employer"]), days: z.number().int().min(1).max(365).nullable() }).safeParse({ who, kind, days });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  let target = uuid.safeParse(p.data.who).success ? p.data.who : null;
  if (!target) {
    const { data } = await supabase.rpc("admin_find_user", { p_email: p.data.who });
    target = (data as string | null) ?? null;
  }
  if (!target) return { ok: false, error: "not_found" };
  const { error } = await supabase.from("featured_pins").upsert({
    user_id: target, kind: p.data.kind, pinned_by: userId, until: p.data.days ? new Date(Date.now() + p.data.days * 86_400_000).toISOString() : null,
  });
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}

export async function unpinFeatured(userId: string, kind: string): Promise<R> {
  const p = z.object({ u: uuid, k: z.enum(["seller", "buyer", "applicant", "employer"]) }).safeParse({ u: userId, k: kind });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("featured_pins").delete().eq("user_id", p.data.u).eq("kind", p.data.k);
  revalidatePath("/admin");
  return error ? fail(error) : { ok: true };
}
