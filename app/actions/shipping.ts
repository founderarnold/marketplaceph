"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type R = { ok: boolean; error?: string };
const uuid = z.uuid();
const KINDS = ["courier", "on_demand", "trucking", "bus", "van_jeep", "pickup", "other"] as const;

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  return { supabase, userId: userId ?? null };
}

/** Sellers and buyers can both save their own couriers, truckers, bus lines, etc. */
export async function addCustomMethod(input: { name: string; kind: string; notes?: string; link?: string }): Promise<R> {
  const p = z
    .object({ name: z.string().trim().min(2).max(60), kind: z.enum(KINDS), notes: z.string().trim().max(200).optional(), link: z.string().trim().max(300).optional() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (p.data.link && !/^https?:\/\//i.test(p.data.link)) return { ok: false, error: "link" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("shipping_methods").insert({
    owner_id: userId, name: p.data.name, kind: p.data.kind, notes: p.data.notes || null, link: p.data.link || null,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : error.message.includes("25") ? "limit" : "failed" };
  revalidatePath("/my/shipping");
  return { ok: true };
}

export async function deleteCustomMethod(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.from("shipping_methods").delete().eq("id", id); // RLS: only your own
  revalidatePath("/my/shipping");
  return { ok: true };
}

/** Replace the set of methods your store supports. */
export async function setStoreShipping(methodIds: string[]): Promise<R> {
  if (!z.array(uuid).max(60).safeParse(methodIds).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) return { ok: false, error: "no_store" };
  const { data: current } = await supabase.from("store_shipping_methods").select("method_id").eq("store_id", store.id);
  const have = new Set((current ?? []).map((c) => c.method_id));
  const want = new Set(methodIds);
  const remove = [...have].filter((m) => !want.has(m));
  const add = [...want].filter((m) => !have.has(m));
  if (remove.length) await supabase.from("store_shipping_methods").delete().eq("store_id", store.id).in("method_id", remove);
  if (add.length) {
    const { error } = await supabase.from("store_shipping_methods").insert(add.map((method_id) => ({ store_id: store.id, method_id })));
    if (error) return { ok: false, error: "failed" };
  }
  revalidatePath("/my/shipping");
  return { ok: true };
}

/** Per-listing override. An empty list means "use the store's methods". */
export async function setListingShipping(listingId: string, methodIds: string[]): Promise<R> {
  if (!uuid.safeParse(listingId).success || !z.array(uuid).max(60).safeParse(methodIds).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { data: current } = await supabase.from("listing_shipping_methods").select("method_id").eq("listing_id", listingId);
  const have = new Set((current ?? []).map((c) => c.method_id));
  const want = new Set(methodIds);
  const remove = [...have].filter((m) => !want.has(m));
  const add = [...want].filter((m) => !have.has(m));
  if (remove.length) await supabase.from("listing_shipping_methods").delete().eq("listing_id", listingId).in("method_id", remove);
  if (add.length) {
    const { error } = await supabase.from("listing_shipping_methods").insert(add.map((method_id) => ({ listing_id: listingId, method_id })));
    if (error) return { ok: false, error: "failed" };
  }
  revalidatePath("/my/shipping");
  return { ok: true };
}

export async function addPaymentMethod(input: { kind: string; accountName?: string; accountNumber?: string; bankName?: string; instructions?: string }): Promise<R> {
  const p = z
    .object({
      kind: z.enum(["gcash", "maya", "bank", "cod", "other"]),
      accountName: z.string().trim().max(80).optional(), accountNumber: z.string().trim().max(40).optional(),
      bankName: z.string().trim().max(60).optional(), instructions: z.string().trim().max(300).optional(),
    })
    .refine((v) => v.kind === "cod" || (!!v.accountName && !!v.accountNumber))
    .safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) return { ok: false, error: "no_store" };
  const { error } = await supabase.from("store_payment_methods").insert({
    store_id: store.id, kind: p.data.kind, account_name: p.data.accountName || null, account_number: p.data.accountNumber || null,
    bank_name: p.data.bankName || null, instructions: p.data.instructions || null,
  });
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/my/shipping");
  return { ok: true };
}

export async function deletePaymentMethod(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.from("store_payment_methods").delete().eq("id", id);
  revalidatePath("/my/shipping");
  return { ok: true };
}
