"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { AFFILIATE_COOKIE } from "@/lib/affiliate";
import { DISPUTE_REASONS, friendlyDbError } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export type R = { ok: boolean; error?: string; id?: string; notes?: string[] };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
const fail = (message?: string): R => ({ ok: false, error: friendlyDbError(message) ?? "failed" });
const uuid = z.uuid();
const done = (id?: string): R => {
  revalidatePath("/orders");
  if (id) revalidatePath(`/orders/${id}`);
  return { ok: true, id };
};

/* ───────────── Cart ───────────── */
export async function addToCart(listingId: string, quantity: number): Promise<R> {
  const parsed = z.object({ id: uuid, qty: z.number().int().min(1).max(1_000_000) }).safeParse({ id: listingId, qty: quantity });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };
  const { data: l } = await supabase.from("listings").select("moq, stock_status, status").eq("id", parsed.data.id).maybeSingle();
  if (!l || l.status !== "active") return { ok: false, error: "unavailable" };
  if (l.stock_status === "out_of_stock") return { ok: false, error: "out_of_stock" };
  if (parsed.data.qty < l.moq) return { ok: false, error: `moq:${l.moq}` };
  const { error } = await supabase.from("cart_items").upsert({ user_id: userId, listing_id: parsed.data.id, quantity: parsed.data.qty }, { onConflict: "user_id,listing_id" });
  if (error) return fail(error.message);
  revalidatePath("/cart");
  return { ok: true };
}

export async function updateCartQty(itemId: string, quantity: number): Promise<R> {
  if (!uuid.safeParse(itemId).success || !Number.isInteger(quantity) || quantity < 1) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", itemId);
  revalidatePath("/cart");
  return error ? fail(error.message) : { ok: true };
}

export async function removeCartItem(itemId: string): Promise<R> {
  if (!uuid.safeParse(itemId).success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  await supabase.from("cart_items").delete().eq("id", itemId);
  revalidatePath("/cart");
  return { ok: true };
}

/* ───────────── Buyer: request ───────────── */
const placeSchema = z.object({
  storeId: uuid,
  urgency: z.enum(["standard", "urgent"]),
  preferredMethodId: uuid.nullable(),
  note: z.string().trim().max(500).optional(),
  delivery: z.object({
    recipient_name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(20),
    address: z.string().trim().min(5).max(300),
    landmark: z.string().trim().max(200).optional(),
    region_code: z.string().optional(),
    province_code: z.string().optional(),
    city_code: z.string().optional(),
  }),
});

/** Turns the buyer's cart items for one store into an order request. */
export async function placeOrder(input: z.input<typeof placeSchema>): Promise<R> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };
  const { data: cart } = await supabase.from("cart_items").select("listing_id, quantity, listings!inner ( store_id )").eq("user_id", userId);
  const items = (cart ?? []).filter((c) => c.listings.store_id === parsed.data.storeId).map((c) => ({ listing_id: c.listing_id, quantity: c.quantity }));
  if (!items.length) return { ok: false, error: "empty_cart" };
  const { data, error } = await supabase.rpc("place_order", {
    p_store: parsed.data.storeId,
    p_items: items,
    p_delivery: parsed.data.delivery,
    p_urgency: parsed.data.urgency,
    p_preferred: parsed.data.preferredMethodId ?? undefined,
    p_note: parsed.data.note,
  });
  if (error) return fail(error.message);
  // Credit an affiliate if this browser arrived through an approved affiliate link (silent no-op otherwise).
  const jar = await cookies();
  const aff = jar.get(AFFILIATE_COOKIE)?.value;
  if (aff) {
    const { data: attached } = await supabase.rpc("attach_affiliate", { p_order: data as string, p_code: aff });
    if (attached) jar.delete(AFFILIATE_COOKIE);
  }
  revalidatePath("/cart");
  return done(data as string);
}

/* ───────────── Seller: quote ───────────── */
const quoteSchema = z.object({
  orderId: uuid,
  items: z.array(z.object({ id: uuid, unit_price: z.number().min(0).max(100_000_000).nullable(), available_qty: z.number().int().min(0).max(10_000_000) })).min(1).max(30),
  shippingFee: z.number().min(0).max(1_000_000),
  methodId: uuid.nullable(),
  note: z.string().trim().max(500).optional(),
  validDays: z.number().int().min(1).max(14),
});
export async function quoteOrder(input: z.input<typeof quoteSchema>): Promise<R> {
  const p = quoteSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("quote_order", {
    p_order: p.data.orderId, p_items: p.data.items, p_shipping_fee: p.data.shippingFee,
    p_method: p.data.methodId ?? undefined, p_note: p.data.note, p_valid_days: p.data.validDays,
  });
  return error ? fail(error.message) : done(p.data.orderId);
}

/* ───────────── Buyer: pay ───────────── */
const paySchema = z.object({
  orderId: uuid,
  method: z.enum(["gcash", "maya", "bank", "cod", "other"]),
  reference: z.string().trim().max(60).optional(),
  amount: z.number().min(0).max(100_000_000).optional(),
  proofPath: z.string().max(300).nullable().optional(),
});
export async function submitPayment(input: z.input<typeof paySchema>): Promise<R> {
  const p = paySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("submit_payment", {
    p_order: p.data.orderId, p_method: p.data.method, p_reference: p.data.reference, p_amount: p.data.amount, p_proof_path: p.data.proofPath ?? undefined,
  });
  return error ? fail(error.message) : done(p.data.orderId);
}

/* ───────────── Seller: receive payment, pack, ship, deliver ───────────── */
export async function reviewPayment(orderId: string, confirm: boolean, note?: string): Promise<R> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("review_payment", { p_order: orderId, p_confirm: confirm, p_note: note?.slice(0, 300) });
  return error ? fail(error.message) : done(orderId);
}

export async function submitPacking(orderId: string, checked: string[], photos: string[], note?: string): Promise<R> {
  const p = z.object({ id: uuid, checked: z.array(uuid).max(30), photos: z.array(z.string().max(300)).min(1).max(6) }).safeParse({ id: orderId, checked, photos });
  if (!p.success) return { ok: false, error: "photos" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("submit_packing", { p_order: p.data.id, p_checked: p.data.checked, p_photos: p.data.photos, p_note: note?.slice(0, 300) });
  return error ? fail(error.message) : done(orderId);
}

const shipSchema = z.object({
  orderId: uuid,
  methodId: uuid.nullable(),
  details: z.object({
    method_name: z.string().max(60).optional(), tracking_number: z.string().max(80).optional(), booking_link: z.string().max(300).optional(),
    driver_name: z.string().max(80).optional(), driver_phone: z.string().max(20).optional(), plate_no: z.string().max(20).optional(),
    bus_line: z.string().max(80).optional(), bus_terminal_from: z.string().max(120).optional(), bus_terminal_to: z.string().max(120).optional(),
    eta: z.string().max(40).optional(), waybill_path: z.string().max(300).optional(), notes: z.string().max(300).optional(),
  }),
});
export async function shipOrder(input: z.input<typeof shipSchema>): Promise<R> {
  const p = shipSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const link = p.data.details.booking_link;
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: "link" };
  // drop empty strings so the database treats them as "not provided"
  const details = Object.fromEntries(Object.entries(p.data.details).filter(([, v]) => v !== undefined && v !== ""));
  if (details.eta) {
    const t = new Date(String(details.eta));
    if (Number.isNaN(t.getTime())) return { ok: false, error: "eta" };
    details.eta = t.toISOString();
  }
  const { supabase } = await me();
  const { error } = await supabase.rpc("ship_order", { p_order: p.data.orderId, p_method: p.data.methodId ?? undefined, p_details: details });
  return error ? fail(error.message) : done(p.data.orderId);
}

export async function markDelivered(orderId: string): Promise<R> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("mark_delivered", { p_order: orderId });
  return error ? fail(error.message) : done(orderId);
}

export async function confirmReceived(orderId: string): Promise<R> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("confirm_received", { p_order: orderId });
  return error ? fail(error.message) : done(orderId);
}

export async function cancelOrder(orderId: string, reason?: string): Promise<R> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId, p_reason: reason?.slice(0, 300) });
  return error ? fail(error.message) : done(orderId);
}

/* ───────────── Disputes ───────────── */
export async function openDispute(orderId: string, reason: string, details: string, paths: string[]): Promise<R> {
  const p = z.object({ id: uuid, reason: z.enum(DISPUTE_REASONS), details: z.string().trim().min(10).max(2000), paths: z.array(z.string().max(300)).max(6) }).safeParse({ id: orderId, reason, details, paths });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("open_dispute", { p_order: p.data.id, p_reason: p.data.reason, p_details: p.data.details, p_paths: p.data.paths });
  return error ? fail(error.message) : done(orderId);
}

export async function respondToDispute(orderId: string, disputeId: string, body: string, paths: string[]): Promise<R> {
  const p = z.object({ id: uuid, body: z.string().trim().min(5).max(2000), paths: z.array(z.string().max(300)).max(6) }).safeParse({ id: disputeId, body, paths });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await me();
  const { error } = await supabase.rpc("dispute_respond", { p_dispute: p.data.id, p_body: p.data.body, p_paths: p.data.paths });
  return error ? fail(error.message) : done(orderId);
}

/* ───────────── Reorder ───────────── */
/**
 * One tap: copies a past order's items into the cart at their CURRENT price/stock rules.
 * Items that are gone or out of stock are skipped; quantities below today's MOQ are raised to it.
 * Returns human-readable notes (i18n keys with params) about anything adjusted.
 */
export async function reorder(orderId: string): Promise<R> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };
  const { data: order } = await supabase.from("orders").select("id, store_id, order_items ( listing_id, title, quantity, available_qty )").eq("id", orderId).eq("buyer_id", userId).maybeSingle();
  if (!order) return { ok: false, error: "not_found" };

  const notes: string[] = [];
  let added = 0;
  for (const it of order.order_items) {
    const qty = it.available_qty && it.available_qty > 0 ? it.available_qty : it.quantity;
    if (!it.listing_id) { notes.push(`gone:${it.title}`); continue; }
    const { data: l } = await supabase.from("listings").select("moq, stock_status, status, title").eq("id", it.listing_id).maybeSingle();
    if (!l || l.status !== "active") { notes.push(`gone:${it.title}`); continue; }
    if (l.stock_status === "out_of_stock") { notes.push(`out:${l.title}`); continue; }
    const finalQty = Math.max(qty, l.moq);
    if (finalQty !== qty) notes.push(`moq:${l.title}|${l.moq}`);
    const { error } = await supabase.from("cart_items").upsert({ user_id: userId, listing_id: it.listing_id, quantity: finalQty }, { onConflict: "user_id,listing_id" });
    if (error) { notes.push(`gone:${it.title}`); continue; }
    added++;
  }
  revalidatePath("/cart");
  return { ok: added > 0, error: added ? undefined : "nothing_added", notes };
}
