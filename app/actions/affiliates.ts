"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isProError } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export type AffResult = { ok: boolean; error?: string; upgrade?: boolean };

const uuid = z.uuid();

/** Friendly message from a database error; plan limits get an "upgrade" hint instead of raw SQL text. */
function fail(e: { code?: string; message?: string }): AffResult {
  if (isProError(e)) return { ok: false, upgrade: true, error: e.message };
  const clean = e.message && !/violates|constraint|schema cache|function public\./i.test(e.message) ? e.message : "failed";
  return { ok: false, error: clean };
}

async function db() {
  return createClient();
}

/** An affiliate asks to promote a listing. The seller still has to approve before the link earns anything. */
export async function requestAffiliateLink(listingId: string, message?: string): Promise<AffResult> {
  if (!uuid.safeParse(listingId).success) return { ok: false, error: "invalid" };
  const { error } = await (await db()).rpc("request_affiliate_link", { p_listing: listingId, p_message: message?.slice(0, 300) });
  if (error) return fail(error);
  revalidatePath(`/listing/${listingId}`);
  revalidatePath("/business/affiliates");
  return { ok: true };
}

export async function decideAffiliateLink(linkId: string, approve: boolean): Promise<AffResult> {
  if (!uuid.safeParse(linkId).success) return { ok: false, error: "invalid" };
  const { error } = await (await db()).rpc("decide_affiliate_link", { p_link: linkId, p_approve: approve });
  if (error) return fail(error);
  revalidatePath("/business/affiliates");
  return { ok: true };
}

export async function revokeAffiliateLink(linkId: string): Promise<AffResult> {
  if (!uuid.safeParse(linkId).success) return { ok: false, error: "invalid" };
  const { error } = await (await db()).rpc("revoke_affiliate_link", { p_link: linkId });
  if (error) return fail(error);
  revalidatePath("/business/affiliates");
  return { ok: true };
}

/** The seller records that they paid the affiliate (outside the platform). */
export async function markCommissionPaid(commissionId: string): Promise<AffResult> {
  if (!uuid.safeParse(commissionId).success) return { ok: false, error: "invalid" };
  const { error } = await (await db()).rpc("mark_commission_paid", { p_commission: commissionId });
  if (error) return fail(error);
  revalidatePath("/business/affiliates");
  return { ok: true };
}
