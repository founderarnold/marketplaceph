"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isProError } from "@/lib/plans";
import { normalizePhonePH } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type R = { ok: boolean; error?: string; pro?: boolean };

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
const uuid = z.uuid();
const fail = (e: { code?: string; message?: string } | null, fallback = "failed"): R =>
  isProError(e) ? { ok: false, pro: true, error: "pro" } : { ok: false, error: e?.message && !/violates|constraint|schema cache|function public\./i.test(e.message) ? e.message : fallback };
const ok = (path: string): R => {
  revalidatePath(path);
  return { ok: true };
};

/* ───────── Plans ───────── */
export async function requestPlan(tier: string, billing: string, note?: string): Promise<R> {
  const p = z.object({ tier: z.enum(["starter", "micro", "neo", "pro", "champion"]), billing: z.enum(["monthly", "yearly"]) }).safeParse({ tier, billing });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("request_plan", { p_tier: p.data.tier, p_billing: p.data.billing, p_note: note?.slice(0, 500) });
  return error ? fail(error) : ok("/business/plan");
}

/* ───────── CRM / suppliers ───────── */
export async function crmSave(storeId: string, buyerId: string, notes: string, tags: string): Promise<R> {
  const p = z.object({ s: uuid, b: uuid, notes: z.string().max(1000), tags: z.string().max(400) }).safeParse({ s: storeId, b: buyerId, notes, tags });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("crm_save", { p_store: p.data.s, p_buyer: p.data.b, p_notes: p.data.notes, p_tags: p.data.tags.split(",").map((t) => t.trim()).filter(Boolean) });
  return error ? fail(error) : ok(`/business/customers/${buyerId}`);
}

export async function saveSupplier(storeId: string, notes: string, tags: string, favorite: boolean): Promise<R> {
  const p = z.object({ s: uuid, notes: z.string().max(1000), tags: z.string().max(400) }).safeParse({ s: storeId, notes, tags });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const clean = [...new Set(p.data.tags.split(",").map((t) => t.trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 10);
  const { error } = await supabase.from("supplier_notes").upsert(
    { buyer_id: userId, store_id: p.data.s, notes: p.data.notes.trim() || null, tags: clean, favorite, updated_at: new Date().toISOString() },
    { onConflict: "buyer_id,store_id" },
  );
  return error ? fail(error) : ok("/business/suppliers");
}

/* ───────── Reminders ───────── */
export async function addRestockReminder(input: { title: string; storeId?: string; everyDays: number }): Promise<R> {
  const p = z.object({ title: z.string().trim().min(2).max(80), storeId: uuid.optional().or(z.literal("")), everyDays: z.number().int().min(1).max(365) }).safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("restock_reminders").insert({
    user_id: userId, title: p.data.title, store_id: p.data.storeId || null, every_days: p.data.everyDays,
    next_run_at: new Date(Date.now() + p.data.everyDays * 86_400_000).toISOString(),
  });
  return error ? fail(error) : ok("/business/reminders");
}

export async function toggleRestockReminder(id: string, enabled: boolean): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.from("restock_reminders").update({ enabled }).eq("id", id);
  return ok("/business/reminders");
}

export async function deleteRestockReminder(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.from("restock_reminders").delete().eq("id", id);
  return ok("/business/reminders");
}

export async function saveFollowUp(input: { storeId: string; buyerId?: string; listingId?: string; everyDays: number; message?: string; enabled?: boolean; id?: string }): Promise<R> {
  const p = z
    .object({ storeId: uuid, buyerId: uuid.optional().or(z.literal("")), listingId: uuid.optional().or(z.literal("")), everyDays: z.number().int().min(7).max(365), message: z.string().max(300).optional(), enabled: z.boolean().optional(), id: uuid.optional() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("save_follow_up_rule", {
    p_store: p.data.storeId, p_every: p.data.everyDays, p_message: p.data.message, p_buyer: p.data.buyerId || undefined, p_listing: p.data.listingId || undefined,
    p_enabled: p.data.enabled ?? true, p_id: p.data.id,
  });
  return error ? fail(error) : ok("/business/reminders");
}

export async function deleteFollowUp(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.rpc("delete_follow_up_rule", { p_id: id });
  return ok("/business/reminders");
}

/** Buyers can stop reminders from any seller (free, always). */
export async function setReminderOptOut(storeId: string, optOut: boolean): Promise<R> {
  if (!uuid.safeParse(storeId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  if (optOut) await supabase.from("reminder_optouts").upsert({ user_id: userId, store_id: storeId }, { onConflict: "user_id,store_id" });
  else await supabase.from("reminder_optouts").delete().eq("user_id", userId).eq("store_id", storeId);
  return ok("/business/reminders");
}

/* ───────── SMS ───────── */
export async function saveSms(phone: string, enabled: boolean): Promise<R> {
  if (!normalizePhonePH(phone)) return { ok: false, error: "phone" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("save_sms_settings", { p_phone: phone, p_enabled: enabled });
  return error ? fail(error) : ok("/business/sms");
}

/** A customer's own choice about receiving restock SMS (opt-in, off by default). */
export async function saveSmsOptIn(accepts: boolean, phone: string): Promise<R> {
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const normalized = phone.trim() ? normalizePhonePH(phone) : null;
  if (phone.trim() && !normalized) return { ok: false, error: "phone" };
  if (accepts && !normalized) return { ok: false, error: "phone" };
  const { error } = await supabase.from("profiles").update({ accepts_sms: accepts, sms_phone: normalized }).eq("id", userId);
  return error ? fail(error) : ok("/business/reminders");
}

/* ───────── Finance ───────── */
const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(100_000_000),
  category: z.string().trim().min(2).max(40),
  note: z.string().trim().max(200).optional(),
  vendor: z.string().trim().max(80).optional(),
});
export async function addIncome(input: z.input<typeof entrySchema>): Promise<R> {
  const p = entrySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("income_entries").insert({ user_id: userId, entry_date: p.data.date, amount: p.data.amount, category: p.data.category, note: p.data.note || null });
  return error ? fail(error) : ok("/business/finance");
}
export async function addExpense(input: z.input<typeof entrySchema>): Promise<R> {
  const p = entrySchema.safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("expenses").insert({ user_id: userId, entry_date: p.data.date, amount: p.data.amount, category: p.data.category, vendor: p.data.vendor || null, note: p.data.note || null });
  return error ? fail(error) : ok("/business/finance");
}
export async function deleteEntry(kind: "income" | "expense", id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  await supabase.from(kind === "income" ? "income_entries" : "expenses").delete().eq("id", id);
  return ok("/business/finance");
}

/* ───────── Inventory ───────── */
export async function adjustStock(listingId: string, newQty: number): Promise<R> {
  if (!uuid.safeParse(listingId).success || !Number.isInteger(newQty) || newQty < 0) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("adjust_stock", { p_listing: listingId, p_new_qty: newQty, p_reason: "count" });
  return error ? fail(error) : ok("/business/inventory");
}

export async function setLowStockThreshold(listingId: string, threshold: number | null): Promise<R> {
  if (!uuid.safeParse(listingId).success || (threshold !== null && (!Number.isInteger(threshold) || threshold < 0))) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("listings").update({ low_stock_threshold: threshold }).eq("id", listingId);
  return error ? fail(error) : ok("/business/inventory");
}
