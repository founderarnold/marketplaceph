/**
 * Phase 3 integration tests: the order lifecycle, who may do what and from which state,
 * payments (proof / COD / rejection / expiry), shipping-method visibility, disputes and their effect on trust.
 * Runs against the LOCAL Supabase stack with seed data; each test cleans up what it creates.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { admin: U(1), buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5), store1: S(1), store2: S(2), store3: S(3), store9: S(9) };

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
});
const guarded = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!reachable) return ctx.skip();
    await fn();
  });

const created: string[] = [];
afterEach(async () => {
  if (!reachable || !created.length) return;
  await svc().from("orders").delete().in("id", created.splice(0));
});

const delivery = { recipient_name: "Buyer Demo", phone: "09171112222", address: "123 Sample St.", region_code: "R3", province_code: "PAMPANGA", city_code: "SANFER" };

async function listingIn(store: string, title?: string) {
  let q = anon().from("listings").select("id, title, moq, price_min").eq("store_id", store).eq("status", "active").eq("price_type", "fixed");
  if (title) q = q.eq("title", title);
  const { data } = await q.limit(1).single();
  return data!;
}

/** Buyer requests an order from store2 (Cebu Sweet Mango) for the 100g pack: qty 100 → tier price ₱88. */
async function request(buyer: Client, qty = 100) {
  const l = await listingIn(ids.store2, "Dried Mango 100g Pack (wholesale)");
  const { data, error } = await buyer.rpc("place_order", {
    p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: qty }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "Please pack well",
  });
  if (error) throw new Error(error.message);
  created.push(data as string);
  return data as string;
}

async function quote(seller: Client, orderId: string, fee = 150) {
  const { data: items } = await seller.from("order_items").select("id, quantity, unit_price").eq("order_id", orderId);
  return seller.rpc("quote_order", {
    p_order: orderId,
    p_items: items!.map((i) => ({ id: i.id, unit_price: i.unit_price, available_qty: i.quantity })),
    p_shipping_fee: fee, p_method: undefined, p_note: "Ready stock", p_valid_days: 3,
  });
}

const gcash = U(2) + "/proof.png";

describe("placing and quoting an order", () => {
  guarded("snapshots items with tier pricing and totals; delivery is private", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const id = await request(buyer, 100);
    const { data: o } = await buyer.from("orders").select("status, amount, quantity, is_full_flow, seller_id").eq("id", id).single();
    expect(o).toMatchObject({ status: "requested", quantity: 100, is_full_flow: true, seller_id: ids.seller2 });
    expect(Number(o!.amount)).toBe(8800); // 100 × ₱88 tier price
    const { data: items } = await buyer.from("order_items").select("title, unit_price, quantity").eq("order_id", id);
    expect(items!.length).toBe(1);
    expect(Number(items![0].unit_price)).toBe(88);

    const seller = await as("seller2@marketplaceph.test");
    expect((await seller.from("order_delivery").select("address").eq("order_id", id)).data!.length).toBe(1);
    const stranger = await as("seller3@marketplaceph.test");
    expect((await stranger.from("orders").select("id").eq("id", id)).data).toEqual([]);
    expect((await stranger.from("order_items").select("id").eq("order_id", id)).data).toEqual([]);
    expect((await stranger.from("order_delivery").select("address").eq("order_id", id)).data).toEqual([]);
    expect((await anon().from("orders").select("id").eq("id", id)).data).toEqual([]);
  });

  guarded("rejects below-MOQ, out-of-stock, own-store and anonymous requests", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const l = await listingIn(ids.store2, "Dried Mango 100g Pack (wholesale)");
    const tiny = await buyer.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: 1 }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" });
    expect(tiny.error?.message).toMatch(/minimum order/i);

    const { data: oos } = await anon().from("listings").select("id").eq("store_id", ids.store9).eq("stock_status", "out_of_stock").limit(1).single();
    const out = await buyer.rpc("place_order", { p_store: ids.store9, p_items: [{ listing_id: oos!.id, quantity: 5 }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" });
    expect(out.error?.message).toMatch(/out of stock/i);

    const seller = await as("seller2@marketplaceph.test");
    const own = await seller.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: 100 }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" });
    expect(own.error?.message).toMatch(/your own store/i);
    const noAddr = await buyer.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: 100 }], p_delivery: { recipient_name: "x" }, p_urgency: "standard", p_preferred: undefined, p_note: "" });
    expect(noAddr.error?.message).toMatch(/delivery/i);
    expect((await anon().rpc("place_order", { p_store: ids.store2, p_items: [], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" })).error).not.toBeNull();
  });

  guarded("a buyer cannot add their own store's listing to the cart; cart is private", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const l = await listingIn(ids.store2);
    expect((await seller.from("cart_items").insert({ user_id: ids.seller2, listing_id: l.id, quantity: 5 })).error?.message).toMatch(/own store/i);
    const buyer = await as("buyer@marketplaceph.test");
    const ok = await buyer.from("cart_items").insert({ user_id: ids.buyer, listing_id: l.id, quantity: 5 }).select("id").single();
    expect(ok.error).toBeNull();
    expect((await seller.from("cart_items").select("id")).data).toEqual([]);
    await buyer.from("cart_items").delete().eq("id", ok.data!.id);
  });

  guarded("only the seller can quote, and every item needs a price and quantity", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const id = await request(buyer);
    expect((await quote(buyer, id)).error?.message).toMatch(/not found/i);

    const seller = await as("seller2@marketplaceph.test");
    const { data: items } = await seller.from("order_items").select("id, quantity").eq("order_id", id);
    const missing = await seller.rpc("quote_order", { p_order: id, p_items: [{ id: items![0].id, unit_price: 88 }], p_shipping_fee: 0, p_method: undefined, p_note: "", p_valid_days: 3 });
    expect(missing.error?.message).toMatch(/available quantity/i);
    const neg = await seller.rpc("quote_order", { p_order: id, p_items: [{ id: items![0].id, unit_price: 88, available_qty: 100 }], p_shipping_fee: -5, p_method: undefined, p_note: "", p_valid_days: 3 });
    expect(neg.error?.message).toMatch(/shipping fee/i);
    const none = await seller.rpc("quote_order", { p_order: id, p_items: [{ id: items![0].id, unit_price: 88, available_qty: 0 }], p_shipping_fee: 0, p_method: undefined, p_note: "", p_valid_days: 3 });
    expect(none.error?.message).toMatch(/at least one item/i);

    expect((await quote(seller, id, 150)).error).toBeNull();
    const { data: o } = await buyer.from("orders").select("status, amount, shipping_fee").eq("id", id).single();
    expect(o!.status).toBe("quoted");
    expect(Number(o!.amount)).toBe(8800 + 150);
  });

  guarded("direct edits to the order are blocked for both parties", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const id = await request(buyer);
    expect((await buyer.from("orders").update({ status: "completed" }).eq("id", id)).error?.message).toMatch(/order page/i);
    expect((await seller.from("orders").update({ status: "paid" }).eq("id", id)).error?.message).toMatch(/order page/i);
    expect((await buyer.from("orders").update({ amount: 1 }).eq("id", id)).error?.message).toMatch(/cannot be edited/i);
    expect((await buyer.from("orders").insert({ store_id: ids.store2, seller_id: ids.seller2, buyer_id: ids.buyer, summary: "forged", quantity: 1, amount: 1, status: "paid", is_full_flow: true }).select("status, is_full_flow").single()).error).not.toBeNull();
  });
});

describe("payment, packing, shipping, delivery (happy path + guards)", () => {
  guarded("full lifecycle with every guard along the way", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const id = await request(buyer);

    // can't pay before a quote
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "REF-0001", p_amount: 100, p_proof_path: gcash })).error?.message).toMatch(/not waiting for payment/i);
    await quote(seller, id);

    // payment options: buyer and seller see them, strangers don't
    expect(((await buyer.rpc("order_payment_options", { p_order: id })).data ?? []).length).toBeGreaterThan(0);
    expect((await stranger.rpc("order_payment_options", { p_order: id })).data).toEqual([]);
    expect((await anon().rpc("order_payment_options", { p_order: id })).error).not.toBeNull();

    // proof rules
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "12", p_amount: 8950, p_proof_path: gcash })).error?.message).toMatch(/reference/i);
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "REF-0001", p_amount: 8950, p_proof_path: `${ids.seller2}/steal.png` })).error?.message).toMatch(/screenshot/i);
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "maya", p_reference: "REF-0001", p_amount: 8950, p_proof_path: gcash })).error?.message).toMatch(/does not accept/i);
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "REF-0001", p_amount: 8950, p_proof_path: gcash })).error).toBeNull();
    expect((await buyer.from("orders").select("status").eq("id", id).single()).data!.status).toBe("payment_submitted");

    // the buyer can't approve their own payment; strangers can't either; the seller can
    expect((await buyer.rpc("review_payment", { p_order: id, p_confirm: true, p_note: "" })).error?.message).toMatch(/no payment to review/i);
    expect((await stranger.rpc("review_payment", { p_order: id, p_confirm: true, p_note: "" })).error).not.toBeNull();
    // can't skip ahead
    expect((await seller.rpc("submit_packing", { p_order: id, p_checked: [], p_photos: [`${ids.seller2}/p.jpg`], p_note: "" })).error?.message).toMatch(/not ready to be packed/i);
    expect((await seller.rpc("review_payment", { p_order: id, p_confirm: true, p_note: "Received" })).error).toBeNull();
    expect((await buyer.from("orders").select("status, paid_at").eq("id", id).single()).data!.paid_at).not.toBeNull();

    // packing needs the full checklist AND photos
    const { data: items } = await seller.from("order_items").select("id").eq("order_id", id);
    const checked = items!.map((i) => i.id);
    const photo = `${ids.seller2}/pack-${Date.now()}.jpg`;
    expect((await seller.rpc("submit_packing", { p_order: id, p_checked: [], p_photos: [photo], p_note: "" })).error?.message).toMatch(/tick every item/i);
    expect((await seller.rpc("submit_packing", { p_order: id, p_checked: checked, p_photos: [], p_note: "" })).error?.message).toMatch(/photos/i);
    expect((await seller.rpc("submit_packing", { p_order: id, p_checked: checked, p_photos: [`${ids.buyer}/x.jpg`], p_note: "" })).error?.message).toMatch(/invalid photo path/i);
    expect((await seller.rpc("ship_order", { p_order: id, p_method: undefined, p_details: { method_name: "Own rider" } })).error?.message).toMatch(/pack the order/i);
    expect((await seller.rpc("submit_packing", { p_order: id, p_checked: checked, p_photos: [photo], p_note: "All sealed" })).error).toBeNull();
    const { data: proofs } = await buyer.from("packing_proofs").select("created_at, photo_path").eq("order_id", id);
    expect(proofs!.length).toBe(1);
    expect(Math.abs(Date.now() - new Date(proofs![0].created_at).getTime())).toBeLessThan(60_000); // server timestamp

    // shipping (a bus shipment with the bus-specific fields)
    const { data: bus } = await anon().from("shipping_methods").select("id").ilike("name", "Bus terminal%").single();
    expect((await buyer.rpc("ship_order", { p_order: id, p_method: bus!.id, p_details: {} })).error).not.toBeNull();
    expect((await seller.rpc("ship_order", { p_order: id, p_method: bus!.id, p_details: { bus_line: "Victory Liner", bus_terminal_from: "Cubao", bus_terminal_to: "San Fernando", plate_no: "ABC 1234", eta: "2026-10-12T10:00:00Z" } })).error).toBeNull();
    const { data: ship } = await buyer.from("shipments").select("method_kind, bus_line, plate_no, bus_terminal_to").eq("order_id", id).single();
    expect(ship).toMatchObject({ method_kind: "bus", bus_line: "Victory Liner", plate_no: "ABC 1234", bus_terminal_to: "San Fernando" });

    // delivery → only the buyer completes
    expect((await seller.rpc("confirm_received", { p_order: id })).error?.message).toMatch(/nothing to confirm/i);
    expect((await seller.rpc("mark_delivered", { p_order: id })).error).toBeNull();
    expect((await buyer.rpc("mark_delivered", { p_order: id })).error).not.toBeNull();
    const before = (await anon().rpc("store_trust", { p_store: ids.store2 })).data![0].completed_orders;
    expect((await buyer.rpc("confirm_received", { p_order: id })).error).toBeNull();
    const done = (await buyer.from("orders").select("status, confirmed_at").eq("id", id).single()).data!;
    expect(done.status).toBe("completed");
    expect(done.confirmed_at).not.toBeNull();
    expect((await anon().rpc("store_trust", { p_store: ids.store2 })).data![0].completed_orders).toBe(before + 1);

    // reviews open up (Phase 2 rules)
    const rev = await buyer.from("reviews").insert({ order_id: id, reviewer_id: ids.buyer, reviewee_id: ids.buyer, store_id: ids.store2, direction: "seller_to_buyer", rating: 5 }).select("direction").single();
    expect(rev.data!.direction).toBe("buyer_to_seller");
  });

  guarded("seller can reject a payment; the order returns to quoted and reliability reflects it", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const before = (await anon().rpc("user_trust", { p_user: ids.buyer })).data![0].payment_reliability;
    const id = await request(buyer);
    await quote(seller, id);
    await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "FAKE-REF", p_amount: 1, p_proof_path: gcash });
    expect((await seller.rpc("review_payment", { p_order: id, p_confirm: false, p_note: "Amount does not match" })).error).toBeNull();
    expect((await buyer.from("orders").select("status").eq("id", id).single()).data!.status).toBe("quoted");
    expect((await buyer.from("notifications").select("kind").eq("kind", "payment_rejected")).data!.length).toBeGreaterThan(0);
    const after = (await anon().rpc("user_trust", { p_user: ids.buyer })).data![0].payment_reliability;
    expect(before).toBeNull();
    expect(Number(after)).toBe(0); // 1 rejected, 0 confirmed
    await svc().from("payment_proofs").delete().eq("order_id", id);
  });

  guarded("COD only works when the seller offers it, and skips the proof", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const id = await request(buyer);
    await quote(seller2, id);
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "cod", p_reference: "", p_amount: 0, p_proof_path: undefined })).error?.message).toMatch(/does not accept/i);

    // store1 (Kusina ni Aling Nena) offers COD
    const l = await listingIn(ids.store1);
    const { data: oid } = await buyer.rpc("place_order", { p_store: ids.store1, p_items: [{ listing_id: l.id, quantity: Math.max(l.moq, 6) }], p_delivery: delivery, p_urgency: "urgent", p_preferred: undefined, p_note: "" });
    created.push(oid as string);
    const s1 = await as("seller1@marketplaceph.test");
    const { data: items } = await s1.from("order_items").select("id, quantity, unit_price").eq("order_id", oid as string);
    expect((await s1.rpc("quote_order", { p_order: oid as string, p_items: items!.map((i) => ({ id: i.id, unit_price: i.unit_price ?? 100, available_qty: i.quantity })), p_shipping_fee: 100, p_method: undefined, p_note: "", p_valid_days: 2 })).error).toBeNull();
    expect((await buyer.rpc("submit_payment", { p_order: oid as string, p_method: "cod", p_reference: "", p_amount: 0, p_proof_path: undefined })).error).toBeNull();
    expect((await buyer.from("orders").select("status, cod").eq("id", oid as string).single()).data).toMatchObject({ status: "paid", cod: true });
  });

  guarded("an expired quote cannot be paid", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const id = await request(buyer);
    await quote(seller, id);
    await svc().from("orders").update({ quote_expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", id);
    expect((await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "REF-9999", p_amount: 8950, p_proof_path: gcash })).error?.message).toMatch(/expired/i);
    // the seller can re-quote
    expect((await quote(seller, id)).error).toBeNull();
  });
});

describe("cancellation rules", () => {
  guarded("buyer can cancel before paying (not penalised if only requested); seller can cancel later; strangers cannot", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const a = await request(buyer);
    expect((await stranger.rpc("cancel_order", { p_order: a, p_reason: "x" })).error?.message).toMatch(/not found/i);
    const before = (await anon().rpc("user_trust", { p_user: ids.buyer })).data![0].cancellation_rate;
    expect((await buyer.rpc("cancel_order", { p_order: a, p_reason: "Changed my mind" })).error).toBeNull();
    expect((await anon().rpc("user_trust", { p_user: ids.buyer })).data![0].cancellation_rate).toBe(before); // cancelling a request is free

    const b = await request(buyer);
    await quote(seller, b);
    await buyer.rpc("submit_payment", { p_order: b, p_method: "gcash", p_reference: "REF-1234", p_amount: 8950, p_proof_path: gcash });
    await seller.rpc("review_payment", { p_order: b, p_confirm: true, p_note: "" });
    expect((await buyer.rpc("cancel_order", { p_order: b, p_reason: "nope" })).error?.message).toMatch(/before paying/i);
    expect((await seller.rpc("cancel_order", { p_order: b, p_reason: "Out of stock, refunding" })).error).toBeNull();
    expect((await buyer.from("orders").select("status, cancel_reason").eq("id", b).single()).data).toMatchObject({ status: "cancelled", cancel_reason: "Out of stock, refunding" });
  });
});

describe("shipping methods", () => {
  guarded("built-in list is public; custom methods are private to their owner until used on your order", async () => {
    const builtins = (await anon().from("shipping_methods").select("name, kind").is("owner_id", null)).data!;
    expect(builtins.map((m) => m.name)).toEqual(expect.arrayContaining(["Lalamove", "J&T Express", "LBC", "Bus terminal-to-terminal (cargo)", "Pickup / meetup"]));

    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const name = `Kuya Ben Trucking ${Date.now()}`;
    const mine = await buyer.from("shipping_methods").insert({ name, kind: "trucking", owner_id: ids.buyer, notes: "Our usual hauler" }).select("id").single();
    expect(mine.error).toBeNull();
    // owner field can't be spoofed
    expect((await buyer.from("shipping_methods").insert({ name: name + "x", kind: "courier", owner_id: ids.seller2 })).error).not.toBeNull();
    expect((await stranger.from("shipping_methods").select("id").eq("id", mine.data!.id)).data).toEqual([]);
    expect((await seller.from("shipping_methods").select("id").eq("id", mine.data!.id)).data).toEqual([]);

    // buyer names it as preferred on their order → the seller (and only they) can then see and use it
    const l = await listingIn(ids.store2, "Dried Mango 100g Pack (wholesale)");
    const { data: oid } = await buyer.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: 100 }], p_delivery: delivery, p_urgency: "standard", p_preferred: mine.data!.id, p_note: "" });
    created.push(oid as string);
    expect((await seller.from("shipping_methods").select("name").eq("id", mine.data!.id)).data![0].name).toBe(name);
    expect((await stranger.from("shipping_methods").select("id").eq("id", mine.data!.id)).data).toEqual([]);
    // someone else's private method can't be named as preferred
    const bad = await stranger.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: 100 }], p_delivery: delivery, p_urgency: "standard", p_preferred: mine.data!.id, p_note: "" });
    expect(bad.error?.message).toMatch(/invalid shipping method/i);
    await buyer.from("shipping_methods").delete().eq("id", mine.data!.id);
  });

  guarded("sellers choose supported methods for their own store/listings only", async () => {
    const s2 = await as("seller2@marketplaceph.test");
    const s1 = await as("seller1@marketplaceph.test");
    const { data: m } = await anon().from("shipping_methods").select("id").eq("name", "Transportify").single();
    expect((await s1.from("store_shipping_methods").insert({ store_id: ids.store2, method_id: m!.id })).error).not.toBeNull();
    expect((await s2.from("store_shipping_methods").upsert({ store_id: ids.store2, method_id: m!.id })).error).toBeNull();
    expect((await anon().from("store_shipping_methods").select("method_id").eq("store_id", ids.store2)).data!.map((x) => x.method_id)).toContain(m!.id);
    await s2.from("store_shipping_methods").delete().eq("store_id", ids.store2).eq("method_id", m!.id);

    // payment accounts are private to the owner
    expect((await anon().from("store_payment_methods").select("id")).data).toEqual([]);
    expect((await s1.from("store_payment_methods").select("id").eq("store_id", ids.store2)).data).toEqual([]);
    expect((await s2.from("store_payment_methods").select("id").eq("store_id", ids.store2)).data!.length).toBeGreaterThan(0);
  });
});

describe("disputes", () => {
  async function paidOrder() {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const id = await request(buyer);
    await quote(seller, id);
    await buyer.rpc("submit_payment", { p_order: id, p_method: "gcash", p_reference: "REF-5555", p_amount: 8950, p_proof_path: gcash });
    await seller.rpc("review_payment", { p_order: id, p_confirm: true, p_note: "" });
    return { buyer, seller, id };
  }

  guarded("only participants can open one, evidence is shared between parties only, one open at a time", async () => {
    const { buyer, seller, id } = await paidOrder();
    const stranger = await as("seller3@marketplaceph.test");
    expect((await stranger.rpc("open_dispute", { p_order: id, p_reason: "other", p_details: "I am not part of this order." })).error).not.toBeNull();
    expect((await buyer.rpc("open_dispute", { p_order: id, p_reason: "not_received", p_details: "Nothing arrived", p_paths: [`${ids.seller2}/e.jpg`] })).error?.message).toMatch(/invalid file path/i);
    const opened = await buyer.rpc("open_dispute", { p_order: id, p_reason: "not_received", p_details: "Nothing arrived after 10 days", p_paths: [`${ids.buyer}/evidence.jpg`] });
    expect(opened.error).toBeNull();
    expect((await buyer.from("orders").select("status").eq("id", id).single()).data!.status).toBe("disputed");
    expect((await buyer.rpc("open_dispute", { p_order: id, p_reason: "other", p_details: "A second dispute should not open" })).error).not.toBeNull();

    const did = opened.data as string;
    expect((await seller.from("dispute_evidence").select("id").eq("dispute_id", did)).data!.length).toBe(1);
    expect((await stranger.from("dispute_evidence").select("id").eq("dispute_id", did)).data).toEqual([]);
    expect((await stranger.from("disputes").select("id").eq("id", did)).data).toEqual([]);
    expect((await buyer.rpc("dispute_respond", { p_dispute: did, p_body: "I am the opener, not the respondent" })).error).not.toBeNull();
  });

  guarded("admin must wait for the response (or the window), writes a note, and outcomes move the order and the metrics", async () => {
    const { buyer, seller, id } = await paidOrder();
    const admin = await as("admin@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const did = (await buyer.rpc("open_dispute", { p_order: id, p_reason: "not_as_described", p_details: "Packs were half the stated size" })).data as string;

    expect((await stranger.rpc("resolve_dispute", { p_dispute: did, p_outcome: "buyer_favored", p_note: "I should not be able to" })).error?.message).toMatch(/only an admin/i);
    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "buyer_favored", p_note: "Too early to decide" })).error?.message).toMatch(/window is still open/i);

    const lostBefore = (await anon().rpc("store_trust", { p_store: ids.store2 })).data![0].dispute_rate;
    expect((await seller.rpc("dispute_respond", { p_dispute: did, p_body: "They are exactly the stated 100g size; photo attached." })).error).toBeNull();
    expect((await seller.rpc("dispute_respond", { p_dispute: did, p_body: "A second response should be refused" })).error?.message).toMatch(/already responded/i);
    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "buyer_favored", p_note: "" })).error?.message).toMatch(/note/i);
    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "partial", p_note: "Partial refund agreed in chat" })).error?.message).toMatch(/choose how the order ends/i);

    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "buyer_favored", p_note: "Evidence shows the packs were short." })).error).toBeNull();
    expect((await buyer.from("orders").select("status, cancelled_from").eq("id", id).single()).data).toMatchObject({ status: "cancelled", cancelled_from: "disputed" });
    const after = (await anon().rpc("store_trust", { p_store: ids.store2 })).data![0].dispute_rate;
    expect(Number(after)).toBeGreaterThan(Number(lostBefore ?? 0)); // a dispute lost raises the dispute rate
    expect((await buyer.from("disputes").select("outcome, admin_note").eq("id", did).single()).data).toMatchObject({ outcome: "buyer_favored" });
    expect((await seller.from("notifications").select("kind").eq("kind", "dispute_resolved")).data!.length).toBeGreaterThan(0);
    // already resolved
    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "seller_favored", p_note: "Trying again" })).error?.message).toMatch(/not open/i);
    await svc().from("disputes").delete().eq("id", did);
  });

  guarded("a seller-favoured outcome completes the order without hurting the seller's dispute rate", async () => {
    const { buyer, seller, id } = await paidOrder();
    const admin = await as("admin@marketplaceph.test");
    const did = (await buyer.rpc("open_dispute", { p_order: id, p_reason: "not_received", p_details: "Not received yet" })).data as string;
    const before = (await anon().rpc("store_trust", { p_store: ids.store2 })).data![0];
    await seller.rpc("dispute_respond", { p_dispute: did, p_body: "Courier tracking shows delivered and signed." });
    expect((await admin.rpc("resolve_dispute", { p_dispute: did, p_outcome: "seller_favored", p_note: "Tracking confirms delivery." })).error).toBeNull();
    expect((await seller.from("orders").select("status, confirmed_at").eq("id", id).single()).data!.status).toBe("completed");
    const after = (await anon().rpc("store_trust", { p_store: ids.store2 })).data![0];
    expect(after.dispute_rate).toBe(before.dispute_rate);
    expect(after.completed_orders).toBe(before.completed_orders + 1);
    await svc().from("disputes").delete().eq("id", did);
  });

  guarded("a long-completed order can no longer be disputed", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const { data: old } = await buyer.from("orders").select("id").eq("status", "completed").eq("store_id", ids.store2).limit(1).single();
    // seeded legacy deals are not full-flow orders → not disputable here
    expect((await buyer.rpc("open_dispute", { p_order: old!.id, p_reason: "other", p_details: "Trying to dispute a legacy deal" })).error?.message).toMatch(/not found/i);
  });
});
