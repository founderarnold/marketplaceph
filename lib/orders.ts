import type { Database } from "@/lib/supabase/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

/** Order progress for the full flow, in order. (Legacy "recorded deals" use pending_confirmation → completed.) */
export const FLOW: OrderStatus[] = ["requested", "quoted", "payment_submitted", "paid", "packed", "shipped", "delivered", "completed"];

export const STATUS_TONE: Record<OrderStatus, "neutral" | "brand" | "accent" | "success" | "danger"> = {
  pending_confirmation: "accent",
  requested: "brand",
  quoted: "accent",
  payment_submitted: "accent",
  paid: "brand",
  packed: "brand",
  shipped: "brand",
  delivered: "brand",
  completed: "success",
  cancelled: "neutral",
  disputed: "danger",
};

/** Which side has to act next (drives the "your turn" hint in lists). */
export function whoseTurn(status: OrderStatus, role: "buyer" | "seller"): boolean {
  const seller: OrderStatus[] = ["requested", "payment_submitted", "paid", "packed"];
  const buyer: OrderStatus[] = ["quoted", "shipped", "delivered", "pending_confirmation"];
  return role === "seller" ? seller.includes(status) && status !== "pending_confirmation" : buyer.includes(status);
}

export const DISPUTE_REASONS = ["not_received", "not_as_described", "damaged", "incomplete", "payment_not_received", "no_response", "other"] as const;
export const PAYMENT_KINDS = ["gcash", "maya", "bank", "cod", "other"] as const;
export const ONLINE_PAYMENT_KINDS = ["gcash", "maya", "bank", "other"] as const;

/** Client-safe friendly error: show our own DB messages, hide anything else. */
export function friendlyDbError(message: string | undefined): string | null {
  if (!message) return null;
  // Our workflow functions raise human-readable sentences; Postgres/PostgREST internals contain these markers.
  if (/violates|constraint|syntax|permission denied|function public\.|schema cache|null value|JWT|row-level/i.test(message)) return null;
  return message;
}
