"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type DealResult = { ok: boolean; error?: string };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}

/** Database messages we are happy to show as-is (they come from our own guards). */
function friendly(message: string | undefined, fallback = "failed"): string {
  if (!message) return fallback;
  return /restricted|limit|too many|already|only the buyer|window/i.test(message) ? message : fallback;
}

const dealSchema = z.object({
  conversationId: z.uuid(),
  summary: z.string().trim().min(3).max(200),
  quantity: z.number().int().min(1).max(1_000_000),
  amount: z.number().min(0).max(100_000_000),
});

/** Seller records a sale made through a chat. The buyer must confirm it before it counts. */
export async function proposeDeal(input: z.input<typeof dealSchema>): Promise<DealResult> {
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, buyer_id, store_id, listing_id, stores!inner ( owner_id )")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!convo || convo.stores.owner_id !== userId) return { ok: false, error: "forbidden" };

  const { error } = await supabase.from("orders").insert({
    store_id: convo.store_id,
    seller_id: userId,
    buyer_id: convo.buyer_id,
    conversation_id: convo.id,
    listing_id: convo.listing_id,
    summary: parsed.data.summary,
    quantity: parsed.data.quantity,
    amount: parsed.data.amount,
  });
  if (error) return { ok: false, error: error.code === "42501" ? "needs_chat" : friendly(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}

export async function respondToDeal(orderId: string, decision: "completed" | "cancelled"): Promise<DealResult> {
  if (!z.uuid().safeParse(orderId).success || !["completed", "cancelled"].includes(decision)) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("orders").update({ status: decision }).eq("id", orderId);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}

const reviewSchema = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  photos: z.array(z.string().min(3).max(300)).max(4),
});

export async function submitReview(input: z.input<typeof reviewSchema>): Promise<DealResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "auth" };
  if (parsed.data.photos.some((p) => !p.startsWith(`${userId}/`))) return { ok: false, error: "invalid" };

  // direction / reviewee / store are overwritten by a database trigger from the deal itself.
  const { data: order } = await supabase.from("orders").select("store_id, buyer_id, seller_id").eq("id", parsed.data.orderId).maybeSingle();
  if (!order) return { ok: false, error: "forbidden" };
  const { error } = await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    reviewer_id: userId,
    reviewee_id: userId === order.buyer_id ? order.seller_id : order.buyer_id,
    store_id: order.store_id,
    direction: userId === order.buyer_id ? "buyer_to_seller" : "seller_to_buyer",
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
    photos: parsed.data.photos,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "already" : friendly(error.message) };
  revalidatePath("/orders");
  return { ok: true };
}
