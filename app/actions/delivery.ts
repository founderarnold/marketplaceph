"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { cleanPhone, PHONE_RE, RIDER_DOC_TYPES, VEHICLE_KEYS } from "@/lib/delivery";
import { isFullAdmin } from "@/lib/roles";

/* Delivery riders and bookings. Who may do what, limits and banned words are enforced by the database. */

export type DlResult = { ok: boolean; error?: string; id?: string };

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
function fail(e: { message?: string } | null): DlResult {
  const m = e?.message ?? "";
  if (!m || /violates|constraint|permission denied|row-level|schema cache|function public\.|JWT|invalid input/i.test(m)) return { ok: false, error: "failed" };
  return { ok: false, error: m };
}
const blank = (v: unknown) => v === "" || v == null;
const text = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());
const req = (min: number, max: number) => z.string().trim().min(min).max(max);
const phone = z.preprocess(cleanPhone, z.string().regex(PHONE_RE));
const optNum = (max: number) => z.preprocess((v) => (blank(v) ? null : Number(v)), z.number().gt(0).max(max).nullable());
const code = z.preprocess((v) => (blank(v) ? null : v), z.string().max(20).nullable());

/* ───────── Bookings ───────── */

const bookingSchema = z.object({
  order_id: z.preprocess((v) => (blank(v) ? null : v), z.uuid().nullable()),
  item_description: req(3, 200),
  quantity: z.coerce.number().int().min(1).max(100000),
  weight_per_piece_kg: z.coerce.number().gt(0).max(5000),
  total_weight_kg: z.coerce.number().gt(0).max(50000),
  length_cm: optNum(2000),
  width_cm: optNum(2000),
  height_cm: optNum(2000),
  declared_value: z.coerce.number().min(0).max(100_000_000),
  vehicle_type: z.enum(["any", ...VEHICLE_KEYS]),
  pickup_name: req(2, 80),
  pickup_phone: phone,
  pickup_address: req(5, 300),
  pickup_landmark: text(200),
  pickup_region_code: z.string().min(1).max(20),
  pickup_province_code: code,
  pickup_city_code: z.string().min(1).max(20),
  dropoff_name: req(2, 80),
  dropoff_phone: phone,
  dropoff_address: req(5, 300),
  dropoff_landmark: text(200),
  dropoff_region_code: z.string().min(1).max(20),
  dropoff_province_code: code,
  dropoff_city_code: z.string().min(1).max(20),
  // datetime-local from the form is Philippine time
  pickup_at: z.preprocess((v) => (blank(v) ? null : `${v}:00+08:00`), z.iso.datetime({ offset: true }).nullable()),
  offered_fee: z.preprocess((v) => (blank(v) ? null : Number(v)), z.number().min(0).max(1_000_000).nullable()),
  notes: text(1000),
});

export async function createBooking(fd: FormData): Promise<DlResult> {
  const p = bookingSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) {
    const field = String(p.error.issues[0]?.path[0] ?? "");
    return { ok: false, error: /phone/.test(field) ? "bad_phone" : /city|region/.test(field) ? "need_city" : "invalid" };
  }
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data, error } = await supabase.from("delivery_requests").insert({ ...p.data, requester_id: userId }).select("id").single();
  if (error || !data) return fail(error);
  revalidatePath("/delivery");
  redirect(`/delivery/${data.id}?booked=1`);
}

export async function setDeliveryStatus(id: string, status: "picked_up" | "delivered" | "released" | "completed" | "cancelled"): Promise<DlResult> {
  if (!z.uuid().safeParse(id).success || !["picked_up", "delivered", "released", "completed", "cancelled"].includes(status)) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("update_delivery_status", { p_id: id, p_status: status });
  revalidatePath(`/delivery/${id}`);
  revalidatePath("/delivery");
  return error ? fail(error) : { ok: true };
}

export async function inviteRider(requestId: string, riderId: string): Promise<DlResult> {
  if (!z.uuid().safeParse(requestId).success || !z.uuid().safeParse(riderId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("invite_rider", { p_request: requestId, p_rider: riderId });
  revalidatePath(`/delivery/${requestId}`);
  return error ? fail(error) : { ok: true };
}

const offerSchema = z.object({
  request_id: z.uuid(),
  fee: z.coerce.number().min(0).max(1_000_000),
  pickup_eta_minutes: z.preprocess((v) => (blank(v) ? null : Number(v)), z.number().int().min(0).max(10080).nullable()),
  message: text(500),
});

export async function sendDeliveryOffer(fd: FormData): Promise<DlResult> {
  const p = offerSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.from("delivery_offers").insert({ ...p.data, rider_id: userId });
  if (error?.code === "23505") return { ok: false, error: "already_offered" };
  revalidatePath(`/delivery/${p.data.request_id}`);
  return error ? fail(error) : { ok: true };
}

export async function withdrawDeliveryOffer(id: string, requestId: string): Promise<DlResult> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("delivery_offers").update({ status: "withdrawn" }).eq("id", id);
  revalidatePath(`/delivery/${requestId}`);
  return error ? fail(error) : { ok: true };
}

export async function acceptDeliveryOffer(id: string, requestId: string): Promise<DlResult> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("accept_delivery_offer", { p_offer: id });
  revalidatePath(`/delivery/${requestId}`);
  revalidatePath("/delivery");
  return error ? fail(error) : { ok: true };
}

/* ───────── Riders ───────── */

const riderSchema = z.object({
  full_name: req(3, 80),
  phone,
  vehicle_type: z.enum(VEHICLE_KEYS),
  vehicle_model: text(60),
  plate_number: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.string().regex(/^[A-Z0-9][A-Z0-9 -]{1,10}$/)),
  license_number: req(5, 20),
  license_expiry: z.iso.date(),
  region_code: z.string().min(1).max(20),
  province_code: code,
  city_code: code,
  about: text(500),
});
const docsSchema = z.array(z.object({ type: z.enum(RIDER_DOC_TYPES), path: z.string().min(3).max(300) })).min(5).max(12);

export async function submitRiderApplication(fd: FormData, docs: { type: string; path: string }[]): Promise<DlResult> {
  const p = riderSchema.safeParse(Object.fromEntries(fd));
  const d = docsSchema.safeParse(docs);
  if (!p.success) {
    const field = String(p.error.issues[0]?.path[0] ?? "");
    return { ok: false, error: field === "phone" ? "bad_phone" : field === "plate_number" ? "bad_plate" : field === "region_code" ? "need_area" : "invalid" };
  }
  if (!d.success) return { ok: false, error: "need_docs" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { error } = await supabase.rpc("submit_rider_application", { p: p.data, p_docs: d.data });
  if (error) return /expired|Attach|Already|suspended/i.test(error.message) ? { ok: false, error: error.message } : fail(error);
  revalidatePath("/delivery/register");
  revalidatePath("/admin");
  return { ok: true };
}

export async function setRiderAvailable(on: boolean): Promise<DlResult> {
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("set_rider_available", { p_on: !!on });
  revalidatePath("/delivery");
  revalidatePath("/delivery/register");
  return error ? fail(error) : { ok: true };
}

/** Admin, founder or webmaster: approve / ask for more / reject / suspend a rider. */
export async function reviewRider(userId: string, fd: FormData): Promise<DlResult> {
  const p = z
    .object({ u: z.uuid(), decision: z.enum(["approved", "needs_more", "rejected", "suspended"]), note: z.string().trim().max(500) })
    .safeParse({ u: userId, decision: fd.get("decision"), note: fd.get("note") ?? "" });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.rpc("review_rider", { p_user: p.data.u, p_decision: p.data.decision, p_note: p.data.note });
  revalidatePath("/admin");
  return error ? { ok: false, error: /note|Only|not found/i.test(error.message) ? error.message : "failed" } : { ok: true };
}

/** Opens a rider's private document for staff via a 60-second link; every open is logged first. */
export async function getRiderDocUrl(docId: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(docId).success) return { error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { error: "forbidden" };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (!isFullAdmin(me?.role)) return { error: "forbidden" };
  const { data: doc } = await supabase.from("rider_documents").select("storage_path").eq("id", docId).maybeSingle();
  if (!doc) return { error: "not_found" };
  const { error: logErr } = await supabase.from("document_access_logs").insert({ admin_id: userId, kind: "rider", document_id: docId });
  if (logErr) return { error: "log_failed" };
  const { data, error } = await createAdminClient().storage.from("private-docs").createSignedUrl(doc.storage_path, 60);
  return error || !data ? { error: "sign_failed" } : { url: data.signedUrl };
}
