"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* "Looking for" board. Who may do what, limits and banned words are enforced by the database. */

export type RqResult = { ok: boolean; error?: string; id?: string };

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
function fail(e: { message?: string } | null): RqResult {
  const m = e?.message ?? "";
  if (!m || /violates|constraint|permission denied|row-level|schema cache|function public\.|JWT/i.test(m)) return { ok: false, error: "failed" };
  return { ok: false, error: m };
}
const num = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(5_000_000_000).nullable());
const text = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const requestSchema = z
  .object({
    kind: z.enum(["product", "service"]),
    title: z.string().trim().min(5).max(120),
    details: text(2000),
    category_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
    quantity: num,
    unit: text(20),
    budget_min: num,
    budget_max: num,
    region_code: text(20),
    province_code: text(20),
    city_code: text(20),
    needed_by: z.preprocess((v) => (v === "" ? null : v), z.iso.date().nullable()),
  })
  .refine((v) => v.budget_max == null || v.budget_min == null || v.budget_max >= v.budget_min, { path: ["budget_max"] });

export async function createRequest(fd: FormData): Promise<RqResult> {
  const p = requestSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data, error } = await supabase.from("buy_requests").insert({ ...p.data, buyer_id: userId }).select("id").single();
  if (error || !data) return fail(error);
  revalidatePath("/looking-for");
  revalidateTag("buy-requests", "max");
  redirect(`/looking-for/${data.id}?posted=1`);
}

export async function setRequestStatus(id: string, status: "open" | "closed" | "fulfilled"): Promise<RqResult> {
  if (!z.uuid().safeParse(id).success || !["open", "closed", "fulfilled"].includes(status)) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { data, error } = await supabase.from("buy_requests").update({ status }).eq("id", id).select("id");
  revalidatePath(`/looking-for/${id}`);
  revalidatePath("/looking-for");
  revalidateTag("buy-requests", "max");
  return error ? fail(error) : data?.length ? { ok: true } : { ok: false, error: "failed" };
}

export async function deleteRequest(id: string): Promise<RqResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("buy_requests").delete().eq("id", id);
  if (error) return fail(error);
  revalidatePath("/looking-for");
  revalidateTag("buy-requests", "max");
  redirect("/looking-for?tab=mine");
}

const offerSchema = z.object({
  request_id: z.uuid(),
  listing_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
  unit_price: num,
  quantity: num,
  delivery_days: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).max(365).nullable()),
  message: z.string().trim().min(5).max(1000),
});

export async function sendOffer(fd: FormData): Promise<RqResult> {
  const p = offerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) return { ok: false, error: "no_store" };
  const { error } = await supabase.from("buy_request_offers").insert({ ...p.data, seller_id: userId, store_id: store.id });
  if (error?.code === "23505") return { ok: false, error: "already_offered" };
  revalidatePath(`/looking-for/${p.data.request_id}`);
  return error ? fail(error) : { ok: true };
}

export async function withdrawOffer(id: string, requestId: string): Promise<RqResult> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("buy_request_offers").update({ status: "withdrawn" }).eq("id", id);
  revalidatePath(`/looking-for/${requestId}`);
  return error ? fail(error) : { ok: true };
}

/** Accept → opens the chat with that seller; decline → tells the seller. */
export async function respondToOffer(id: string, requestId: string, accept: boolean): Promise<RqResult> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { data: convo, error } = await supabase.rpc("respond_to_offer", { p_offer: id, p_accept: accept });
  if (error) return fail(error);
  revalidatePath(`/looking-for/${requestId}`);
  if (accept && convo) redirect(`/messages/${convo}`);
  return { ok: true };
}
