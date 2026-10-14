/**
 * Delivery riders + bookings, against the LOCAL Supabase stack with seed data.
 * buyer = U(2) books, seller3 = U(5) registers as a rider, seller1 = U(3) is made an admin for the review step.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5) };

type Client = SupabaseClient<Database>;
const anon = (): Client => createClient<Database>(URL, ANON, { auth: { persistSession: false } });
const svc = (): Client => createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
async function as(email: string): Promise<Client> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}

let reachable = false;
beforeAll(async () => {
  try {
    reachable = (await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } })).ok && !!ANON && !!SERVICE;
  } catch {
    reachable = false;
  }
  if (reachable) await cleanup();
});
const guarded = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!reachable) return ctx.skip();
    await fn();
  });

const people = Object.values(ids);
async function cleanup() {
  const db = svc();
  await db.from("delivery_requests").delete().in("requester_id", people);
  await db.from("rider_profiles").delete().in("user_id", people);
  await db.from("user_badges").delete().in("user_id", people).eq("badge", "verified_rider");
  await db.from("profiles").update({ role: "user" }).eq("id", ids.seller1);
  await db.from("notifications").delete().in("user_id", people).like("kind", "%deliver%");
  await db.from("notifications").delete().in("user_id", people).like("kind", "rider_%");
}
afterAll(async () => {
  if (reachable) await cleanup();
});

const nextYear = `${new Date().getFullYear() + 1}-06-30`;
const rider = (over: Record<string, unknown> = {}) => ({
  full_name: "Juan Dela Cruz",
  phone: "09171234567",
  vehicle_type: "motorcycle",
  plate_number: "ABC 1234",
  license_number: "N01-23-456789",
  license_expiry: nextYear,
  region_code: "CAR",
  province_code: "BENGUET",
  city_code: "BAG",
  ...over,
});
const docs = (uid: string, skip?: string) =>
  ["license_front", "license_back", "or_cr", "plate_front", "plate_back"].filter((t) => t !== skip).map((type) => ({ type, path: `${uid}/${type}.jpg` }));
const booking = (over: Record<string, unknown> = {}) => ({
  requester_id: ids.buyer,
  item_description: "3 boxes of dried mango",
  quantity: 3,
  weight_per_piece_kg: 2,
  total_weight_kg: 6,
  declared_value: 2500,
  vehicle_type: "motorcycle",
  pickup_name: "Cebu Sweet Mango",
  pickup_phone: "09170000001",
  pickup_address: "123 Session Rd, Brgy. Upper Session",
  pickup_landmark: "Beside the bank",
  pickup_region_code: "CAR",
  pickup_province_code: "BENGUET",
  pickup_city_code: "BAG",
  dropoff_name: "Maria Buyer",
  dropoff_phone: "09170000002",
  dropoff_address: "45 Km 5, Brgy. Pico",
  dropoff_region_code: "CAR",
  dropoff_province_code: "BENGUET",
  dropoff_city_code: "LATRI",
  ...over,
});

describe("delivery riders", () => {
  guarded("registration needs every photo, stays private, and only a full admin can approve it", async () => {
    const seller3 = await as("seller3@marketplaceph.test");
    const buyer = await as("buyer@marketplaceph.test");
    const missing = await seller3.rpc("submit_rider_application", { p: rider(), p_docs: docs(ids.seller3, "plate_back") });
    expect(missing.error?.message).toMatch(/Attach all required photos/);
    const otherFolder = await seller3.rpc("submit_rider_application", { p: rider(), p_docs: docs(ids.buyer) });
    expect(otherFolder.error?.message).toMatch(/Invalid documents/);
    const expired = await seller3.rpc("submit_rider_application", { p: rider({ license_expiry: "2020-01-01" }), p_docs: docs(ids.seller3) });
    expect(expired.error?.message).toMatch(/expired/);

    expect((await seller3.rpc("submit_rider_application", { p: rider(), p_docs: docs(ids.seller3) })).error).toBeNull();
    expect((await seller3.rpc("submit_rider_application", { p: rider(), p_docs: docs(ids.seller3) })).error?.message).toMatch(/Already submitted/);
    // license number and documents are not visible to other users, and pending riders aren't listed
    expect((await buyer.from("rider_profiles").select("license_number").eq("user_id", ids.seller3)).data).toEqual([]);
    expect((await buyer.from("rider_documents").select("id").eq("rider_id", ids.seller3)).data).toEqual([]);
    expect((await anon().rpc("public_riders", { p_ids: [ids.seller3] })).data).toEqual([]);

    // a normal user can't approve
    expect((await buyer.rpc("review_rider", { p_user: ids.seller3, p_decision: "approved" })).error?.message).toMatch(/Only an admin/);
    await svc().from("profiles").update({ role: "webmaster" }).eq("id", ids.seller1);
    const admin = await as("seller1@marketplaceph.test");
    expect((await admin.rpc("review_rider", { p_user: ids.seller3, p_decision: "needs_more" })).error?.message).toMatch(/note/);
    expect((await admin.from("rider_documents").select("id").eq("rider_id", ids.seller3)).data).toHaveLength(5);
    expect((await admin.rpc("review_rider", { p_user: ids.seller3, p_decision: "approved" })).error).toBeNull();
    expect((await anon().from("user_badges").select("badge").eq("user_id", ids.seller3).eq("badge", "verified_rider")).data).toHaveLength(1);

    // the public card shows first name + initial and area, never the phone or plate
    const pub = (await anon().rpc("public_riders", { p_region: "CAR", p_city: "BAG" })).data!;
    const me = pub.find((r) => r.user_id === ids.seller3)!;
    expect(me.name).toBe("Juan C.");
    expect(me.nearness).toBe(0);
    expect(JSON.stringify(me)).not.toMatch(/0917|ABC/);
  });

  guarded("booking → offer → hire → pickup → delivered → received, with addresses hidden until hired", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");

    expect((await buyer.from("delivery_requests").insert(booking({ pickup_phone: "call me" }))).error).not.toBeNull();
    const { data: b, error } = await buyer.from("delivery_requests").insert(booking()).select("id").single();
    expect(error).toBeNull();
    // someone else's order can't be linked
    const { data: otherOrder } = await svc().from("orders").select("id").neq("buyer_id", ids.buyer).neq("seller_id", ids.buyer).limit(1).maybeSingle();
    if (otherOrder) expect((await buyer.from("delivery_requests").insert(booking({ order_id: otherOrder.id }))).error?.message).toMatch(/own order/);

    // the rider sees the job but not the exact address or numbers
    expect((await seller3.from("delivery_requests").select("id").eq("id", b!.id)).data).toEqual([]);
    const summary = (await seller3.rpc("open_deliveries", { p_id: b!.id })).data!;
    expect(summary).toHaveLength(1);
    expect(summary[0].pickup_city).toBe("Baguio City");
    expect(JSON.stringify(summary)).not.toMatch(/Session Rd|09170000001|Maria/);
    // non-riders get nothing and can't offer
    expect((await seller2.rpc("open_deliveries", { p_id: b!.id })).data).toEqual([]);
    expect((await seller2.from("delivery_offers").insert({ request_id: b!.id, rider_id: ids.seller2, fee: 100 })).error?.message).toMatch(/verified riders/);

    expect((await buyer.rpc("invite_rider", { p_request: b!.id, p_rider: ids.seller3 })).error).toBeNull();
    expect((await seller3.rpc("open_deliveries", { p_id: b!.id })).data![0].invited).toBe(true);

    const { data: offer } = await seller3.from("delivery_offers").insert({ request_id: b!.id, rider_id: ids.seller3, fee: 180, pickup_eta_minutes: 20 }).select("id").single();
    expect(offer).toBeTruthy();
    expect((await seller3.from("delivery_offers").insert({ request_id: b!.id, rider_id: ids.seller3, fee: 150 })).error?.code).toBe("23505");
    // the rider can't accept their own offer or move the job forward before being hired
    expect((await seller3.rpc("accept_delivery_offer", { p_offer: offer!.id })).error).not.toBeNull();
    expect((await seller3.rpc("update_delivery_status", { p_id: b!.id, p_status: "picked_up" })).error).not.toBeNull();

    expect((await buyer.rpc("accept_delivery_offer", { p_offer: offer!.id })).error).toBeNull();
    const full = (await seller3.from("delivery_requests").select("status, pickup_phone, agreed_fee").eq("id", b!.id).single()).data!;
    expect(full).toMatchObject({ status: "assigned", pickup_phone: "09170000001", agreed_fee: 180 });
    const contact = (await buyer.rpc("delivery_rider_contact", { p_id: b!.id })).data!;
    expect(contact[0]).toMatchObject({ phone: "09171234567", plate_number: "ABC 1234" });
    expect((await seller2.rpc("delivery_rider_contact", { p_id: b!.id })).data).toEqual([]);
    // no longer listed for other riders
    expect((await seller3.rpc("open_deliveries", { p_id: b!.id })).data).toEqual([]);

    // steps in order, each by the right person
    expect((await buyer.rpc("update_delivery_status", { p_id: b!.id, p_status: "picked_up" })).error).not.toBeNull();
    expect((await seller3.rpc("update_delivery_status", { p_id: b!.id, p_status: "delivered" })).error).not.toBeNull();
    expect((await seller3.rpc("update_delivery_status", { p_id: b!.id, p_status: "picked_up" })).error).toBeNull();
    expect((await buyer.rpc("update_delivery_status", { p_id: b!.id, p_status: "cancelled" })).error).not.toBeNull();
    expect((await seller3.rpc("update_delivery_status", { p_id: b!.id, p_status: "delivered" })).error).toBeNull();
    expect((await buyer.rpc("update_delivery_status", { p_id: b!.id, p_status: "completed" })).error).toBeNull();
    // the rider can't rewrite the booking directly
    expect((await seller3.from("delivery_requests").update({ agreed_fee: 9999 }).eq("id", b!.id).select("id")).data).toEqual([]);

    const card = (await anon().rpc("public_riders", { p_ids: [ids.seller3] })).data![0];
    expect(card.completed).toBe(1);
    const notes = (await svc().from("notifications").select("kind").eq("user_id", ids.buyer).like("kind", "delivery_%")).data!.map((n) => n.kind);
    expect(notes).toEqual(expect.arrayContaining(["delivery_offer", "delivery_picked_up", "delivery_delivered"]));
  });

  guarded("vehicle must match, and a rider who gives the job back reopens it", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");
    const { data: van } = await buyer.from("delivery_requests").insert(booking({ vehicle_type: "closed_van", total_weight_kg: 800 })).select("id").single();
    expect((await seller3.from("delivery_offers").insert({ request_id: van!.id, rider_id: ids.seller3, fee: 2000 })).error?.message).toMatch(/different vehicle/);

    const { data: b } = await buyer.from("delivery_requests").insert(booking({ vehicle_type: "any" })).select("id").single();
    const { data: offer } = await seller3.from("delivery_offers").insert({ request_id: b!.id, rider_id: ids.seller3, fee: 150 }).select("id").single();
    await buyer.rpc("accept_delivery_offer", { p_offer: offer!.id });
    expect((await seller3.rpc("update_delivery_status", { p_id: b!.id, p_status: "released" })).error).toBeNull();
    const row = (await buyer.from("delivery_requests").select("status, rider_id").eq("id", b!.id).single()).data!;
    expect(row).toEqual({ status: "open", rider_id: null });
    expect((await seller3.from("delivery_requests").select("id").eq("id", b!.id)).data).toEqual([]);

    // re-submitting papers pauses the badge until checked again
    expect((await seller3.rpc("submit_rider_application", { p: rider({ vehicle_type: "sedan" }), p_docs: docs(ids.seller3) })).error).toBeNull();
    expect((await anon().from("user_badges").select("badge").eq("user_id", ids.seller3).eq("badge", "verified_rider")).data).toEqual([]);
  });
});
