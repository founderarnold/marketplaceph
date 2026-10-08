/**
 * Phase 5 integration tests: listing caps per FLAME tier, affiliate links with seller approval and quotas,
 * commission accounting, featured stores and the public feed gate.
 * Runs against the LOCAL Supabase stack with seed data (seller1 = Apprentice, seller2 = Pro, seller3 = Neo, seller4 = Champion).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { admin: U(1), buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5), seller4: U(6), store1: S(1), store2: S(2), store3: S(3), store4: S(4) };
const PACK = "Dried Mango 100g Pack (wholesale)";

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

const delivery = { recipient_name: "Buyer Demo", phone: "09171112222", address: "123 Sample St.", region_code: "R3", province_code: "PAMPANGA", city_code: "SANFER" };
const createdListings: string[] = [];
const createdOrders: string[] = [];

async function listingRow(store: string, i: number, categoryId: string) {
  return { store_id: store, category_id: categoryId, kind: "product" as const, title: `Cap test item ${i}`, price_type: "fixed" as const, price_min: 10, unit: "pc", moq: 1 };
}

afterEach(async () => {
  if (!reachable) return;
  const db = svc();
  if (createdOrders.length) await db.from("orders").delete().in("id", createdOrders.splice(0));
  if (createdListings.length) await db.from("listings").delete().in("id", createdListings.splice(0));
  await db.from("affiliate_links").delete().neq("code", "demo2024").neq("code", "demo2025");
  await db.from("listings").update({ commission_pct: null }).eq("store_id", ids.store2).not("title", "eq", PACK);
  await db.from("listings").update({ commission_pct: 10 }).eq("store_id", ids.store2).eq("title", PACK);
  await db.from("subscriptions").delete().eq("user_id", ids.seller1);
});
afterAll(async () => {
  if (!reachable) return;
  await svc().from("subscriptions").delete().eq("user_id", ids.seller1);
});

describe("listing cap per tier", () => {
  guarded("Apprentice is limited to 10 listings; upgrading raises the limit; removed listings don't count", async () => {
    const seller = await as("seller1@marketplaceph.test");
    const admin = await as("admin@marketplaceph.test");
    const db = svc();
    const { data: cat } = await db.from("categories").select("id").limit(1).single();
    const used = (await seller.rpc("listing_usage")).data![0];
    expect(used.listing_limit).toBe(10);
    // fill to the cap with service-role inserts (the cap only applies to signed-in users)
    const fill = Math.max(0, 10 - used.used);
    for (let i = 0; i < fill; i++) {
      const { data } = await db.from("listings").insert(await listingRow(ids.store1, i, cat!.id)).select("id").single();
      createdListings.push(data!.id);
    }
    expect((await seller.rpc("listing_usage")).data![0].used).toBe(10);
    const blocked = await seller.from("listings").insert(await listingRow(ids.store1, 99, cat!.id)).select("id").single();
    expect(blocked.error?.code).toBe("P0003");
    expect(blocked.error?.message).toMatch(/plan allows 10 listings/i);

    // hiding keeps it counted; a "removed" (moderated) listing frees a slot
    await db.from("listings").update({ status: "removed" }).eq("id", createdListings[0]);
    const freed = await seller.from("listings").insert(await listingRow(ids.store1, 98, cat!.id)).select("id").single();
    expect(freed.error).toBeNull();
    createdListings.push(freed.data!.id);
    expect((await seller.from("listings").insert(await listingRow(ids.store1, 97, cat!.id)).select("id").single()).error?.code).toBe("P0003");
    // re-activating the removed one would exceed the cap
    expect((await db.from("listings").update({ status: "active" }).eq("id", createdListings[0])).error).toBeNull(); // service role is exempt

    await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_days: 1, p_tier: "starter" });
    expect((await seller.rpc("listing_usage")).data![0].listing_limit).toBe(30);
    const more = await seller.from("listings").insert(await listingRow(ids.store1, 96, cat!.id)).select("id").single();
    expect(more.error).toBeNull();
    createdListings.push(more.data!.id);
  });
});

describe("affiliate links", () => {
  const request = (c: Client, listing: string, message?: string) => c.rpc("request_affiliate_link", { p_listing: listing, p_message: message });
  const packId = async () => (await svc().from("listings").select("id").eq("store_id", ids.store2).eq("title", PACK).single()).data!.id;
  const otherListings = async (n: number) => (await svc().from("listings").select("id").eq("store_id", ids.store2).neq("title", PACK).order("title").limit(n)).data!.map((l) => l.id);

  guarded("only listings with a commission can be promoted; the seller must approve; strangers can't decide", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const aff = await as("seller3@marketplaceph.test");
    const [plain] = await otherListings(1);

    expect((await request(aff, plain)).error?.message).toMatch(/not enabled commissions/i);
    expect((await request(seller, await packId())).error?.message).toMatch(/your own listing/i);
    expect((await seller.rpc("set_listing_commission", { p_listing: plain, p_pct: 0.5 })).error?.message).toMatch(/between 1% and 50%/i);
    expect((await aff.rpc("set_listing_commission", { p_listing: plain, p_pct: 10 })).error?.message).toMatch(/not found/i);
    expect((await seller.rpc("set_listing_commission", { p_listing: plain, p_pct: 12.5 })).error).toBeNull();

    const r = await request(aff, plain, "I have 5k followers");
    expect(r.error).toBeNull();
    const link = (await aff.from("affiliate_links").select("id, code, status, seller_id").eq("listing_id", plain).single()).data!;
    expect(link).toMatchObject({ status: "pending", seller_id: ids.seller2 });
    expect((await request(aff, plain)).data).toBe(link.id); // asking again is idempotent
    expect((await seller.from("notifications").select("kind").eq("kind", "affiliate_requested")).data!.length).toBeGreaterThan(0);

    // a pending link earns nothing: no click is recorded and the order cannot attach
    expect((await svc().rpc("record_affiliate_click", { p_code: link.code })).data).toBeNull();

    // other people cannot approve or even see it
    const stranger = await as("seller1@marketplaceph.test");
    expect((await stranger.rpc("decide_affiliate_link", { p_link: link.id, p_approve: true })).error?.message).toMatch(/not found/i);
    expect((await aff.rpc("decide_affiliate_link", { p_link: link.id, p_approve: true })).error?.message).toMatch(/not found/i);
    expect((await stranger.from("affiliate_links").select("id").eq("id", link.id)).data).toEqual([]);

    expect((await seller.rpc("decide_affiliate_link", { p_link: link.id, p_approve: true })).error).toBeNull();
    const approved = (await aff.from("affiliate_links").select("status, rate").eq("id", link.id).single()).data!;
    expect(approved.status).toBe("approved");
    expect(Number(approved.rate)).toBe(12.5);
    expect((await aff.from("notifications").select("kind").eq("kind", "affiliate_approved")).data!.length).toBeGreaterThan(0);
    expect((await svc().rpc("record_affiliate_click", { p_code: link.code })).data).toBe(plain);

    // clients can't call the service-only click recorder or write rows directly
    expect((await aff.rpc("record_affiliate_click", { p_code: link.code })).error).not.toBeNull();
    expect((await aff.from("affiliate_links").update({ status: "approved" }).eq("id", link.id)).data).toBeNull();
    expect((await aff.from("affiliate_clicks").insert({ link_id: link.id })).error).not.toBeNull();

    // a declined request stays declined
    const [, second] = await otherListings(2);
    await seller.rpc("set_listing_commission", { p_listing: second, p_pct: 5 });
    await request(aff, second);
    const l2 = (await aff.from("affiliate_links").select("id").eq("listing_id", second).single()).data!;
    expect((await seller.rpc("decide_affiliate_link", { p_link: l2.id, p_approve: false })).error).toBeNull();
    expect((await request(aff, second)).error?.message).toMatch(/declined/i);
  });

  guarded("Apprentice gets 3 links; the 4th needs a higher tier", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const aff = await as("seller1@marketplaceph.test");
    const admin = await as("admin@marketplaceph.test");
    const db = svc();
    const { data: cat } = await db.from("categories").select("id").limit(1).single();
    const five: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { data } = await db.from("listings").insert(await listingRow(ids.store2, i, cat!.id)).select("id").single();
      createdListings.push(data!.id);
      five.push(data!.id);
    }
    for (const id of five) await seller.rpc("set_listing_commission", { p_listing: id, p_pct: 5 });

    expect((await aff.rpc("affiliate_quota")).data![0]).toMatchObject({ used: 0, quota: 3 });
    for (const id of five.slice(0, 3)) expect((await request(aff, id)).error).toBeNull();
    expect((await aff.rpc("affiliate_quota")).data![0]).toMatchObject({ used: 3, quota: 3 });
    const fourth = await request(aff, five[3]);
    expect(fourth.error?.code).toBe("P0003");
    expect(fourth.error?.message).toMatch(/allows 3 affiliate links/i);

    // ending a link frees a slot
    const first = (await aff.from("affiliate_links").select("id").eq("listing_id", five[0]).single()).data!;
    expect((await aff.rpc("revoke_affiliate_link", { p_link: first.id })).error).toBeNull();
    expect((await request(aff, five[3])).error).toBeNull();
    expect((await request(aff, five[4])).error?.code).toBe("P0003");

    // upgrading raises the quota: Starter 5, Micro 10
    await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_days: 1, p_tier: "starter" });
    expect((await aff.rpc("affiliate_quota")).data![0].quota).toBe(5);
    expect((await request(aff, five[4])).error).toBeNull();
    // a revoked link can be asked for again (it counts against the quota once more)
    expect((await aff.rpc("affiliate_quota")).data![0]).toMatchObject({ used: 4, quota: 5 });
    expect((await request(aff, five[0])).error).toBeNull();   // the revoked one is requested again
    expect((await aff.rpc("affiliate_quota")).data![0]).toMatchObject({ used: 5, quota: 5 });
  });

  guarded("an order from an approved link earns a commission once the order completes; cancelled orders earn nothing", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const buyer = await as("buyer@marketplaceph.test");
    const aff = await as("seller3@marketplaceph.test");
    const db = svc();
    const pack = await packId();
    expect((await seller.rpc("set_listing_commission", { p_listing: pack, p_pct: 10 })).error).toBeNull();
    expect((await request(aff, pack)).error).toBeNull();
    const link = (await aff.from("affiliate_links").select("id, code").eq("listing_id", pack).single()).data!;
    await seller.rpc("decide_affiliate_link", { p_link: link.id, p_approve: true });

    const place = async () => {
      const { data, error } = await buyer.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: pack, quantity: 100 }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" });
      if (error) throw new Error(error.message);
      createdOrders.push(data as string);
      return data as string;
    };

    const o1 = await place();
    expect((await buyer.rpc("attach_affiliate", { p_order: o1, p_code: "wrong-code" })).data).toBe(false);
    expect((await aff.rpc("attach_affiliate", { p_order: o1, p_code: link.code })).data).toBe(false); // only the buyer can attach
    expect((await buyer.rpc("attach_affiliate", { p_order: o1, p_code: link.code })).data).toBe(true);
    expect((await buyer.rpc("attach_affiliate", { p_order: o1, p_code: link.code })).data).toBe(true); // idempotent (no duplicate row)
    const rows = (await db.from("affiliate_commissions").select("status, amount, rate, affiliate_id, seller_id").eq("order_id", o1)).data!;
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ status: "pending", affiliate_id: ids.seller3, seller_id: ids.seller2 });

    // the buyer cannot be their own affiliate
    const own = await as("buyer@marketplaceph.test");
    const ownLink = await db.from("affiliate_links").insert({ affiliate_id: ids.buyer, listing_id: pack, seller_id: ids.seller2, status: "approved", rate: 10 }).select("code").single();
    if (!ownLink.error) {
      const o = await place();
      expect((await own.rpc("attach_affiliate", { p_order: o, p_code: ownLink.data.code })).data).toBe(false);
    }

    // order completes → earned (100 × ₱88 × 10% = ₱880)
    await db.from("orders").update({ status: "completed" }).eq("id", o1);
    const settled = (await db.from("affiliate_commissions").select("status, amount").eq("order_id", o1)).data!;
    expect(settled[0].status).toBe("earned");
    expect(Number(settled[0].amount)).toBe(880);
    expect((await aff.from("notifications").select("kind").eq("kind", "commission_earned")).data!.length).toBeGreaterThan(0);

    // only the seller can mark it paid, and only once earned
    const c = (await aff.from("affiliate_commissions").select("id").eq("order_id", o1).single()).data!;
    expect((await aff.rpc("mark_commission_paid", { p_commission: c.id })).error?.message).toMatch(/not found/i);
    expect((await seller.rpc("mark_commission_paid", { p_commission: c.id })).error).toBeNull();
    expect((await seller.rpc("mark_commission_paid", { p_commission: c.id })).error?.message).toMatch(/not found|not yet earned/i);
    const dash = (await aff.rpc("affiliate_dashboard")).data!.find((d) => d.link_id === link.id)!;
    expect(Number(dash.paid)).toBe(880);
    expect(Number(dash.earned)).toBe(0);
    expect(Number(dash.orders)).toBeGreaterThanOrEqual(1);

    // a cancelled order earns nothing
    const o2 = await place();
    expect((await buyer.rpc("attach_affiliate", { p_order: o2, p_code: link.code })).data).toBe(true);
    await db.from("orders").update({ status: "cancelled" }).eq("id", o2);
    expect((await db.from("affiliate_commissions").select("status").eq("order_id", o2).single()).data!.status).toBe("void");

    // the buyer and strangers see nothing of the commission rows
    expect((await buyer.from("affiliate_commissions").select("id")).data).toEqual([]);
    expect((await (await as("seller1@marketplaceph.test")).from("affiliate_commissions").select("id")).data).toEqual([]);
  });

  guarded("a revoked link stops tracking clicks and attributing orders", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const aff = await as("seller3@marketplaceph.test");
    const buyer = await as("buyer@marketplaceph.test");
    const pack = await packId();
    await request(aff, pack);
    const link = (await aff.from("affiliate_links").select("id, code").eq("listing_id", pack).single()).data!;
    await seller.rpc("decide_affiliate_link", { p_link: link.id, p_approve: true });
    expect((await seller.rpc("revoke_affiliate_link", { p_link: link.id })).error).toBeNull();
    expect((await svc().rpc("record_affiliate_click", { p_code: link.code })).data).toBeNull();
    const { data } = await buyer.rpc("place_order", { p_store: ids.store2, p_items: [{ listing_id: pack, quantity: 100 }], p_delivery: delivery, p_urgency: "standard", p_preferred: undefined, p_note: "" });
    createdOrders.push(data as string);
    expect((await buyer.rpc("attach_affiliate", { p_order: data as string, p_code: link.code })).data).toBe(false);
  });
});

describe("featured stores and the feed gate", () => {
  guarded("only Champion stores are featured; store_has_tier reveals a yes/no only", async () => {
    const featured = (await anon().rpc("featured_stores", { p_limit: 12 })).data!.map((r) => r.store_id);
    expect(featured).toContain(ids.store4);          // seller4 = Champion
    expect(featured).not.toContain(ids.store2);      // Pro
    expect(featured).not.toContain(ids.store1);      // Apprentice
    expect((await anon().rpc("store_has_tier", { p_store: ids.store3, p_min: 3 })).data).toBe(true);   // Neo may use feeds and embeds
    expect((await anon().rpc("store_has_tier", { p_store: ids.store1, p_min: 3 })).data).toBe(false);
    expect((await anon().rpc("store_has_tier", { p_store: ids.store4, p_min: 5 })).data).toBe(true);
    // the public cannot read subscriptions to work this out another way
    expect((await anon().from("subscriptions").select("user_id")).data ?? []).toEqual([]);
  });

  guarded("website / Facebook links must be http(s)", async () => {
    const seller = await as("seller2@marketplaceph.test");
    expect((await seller.from("stores").update({ website_url: "javascript:alert(1)" }).eq("id", ids.store2)).error).not.toBeNull();
    expect((await seller.from("stores").update({ facebook_url: "ftp://x" }).eq("id", ids.store2)).error).not.toBeNull();
    expect((await seller.from("stores").update({ website_url: "https://example.com/cebu-sweet-mango" }).eq("id", ids.store2)).error).toBeNull();
  });
});
