/**
 * Phase 4 integration tests: tier gating, CRM / suppliers, reports, finance, inventory and reminders.
 * Runs against the LOCAL Supabase stack with seed data (seller2 = Pro, buyer = Micro, admin = Champion, seller3 = Neo, seller4 = Champion; seller1 is Apprentice).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { admin: U(1), buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5), store1: S(1), store2: S(2) };
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

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const created: string[] = [];
async function packListing() {
  const { data } = await svc().from("listings").select("id, quantity_on_hand, stock_status").eq("store_id", ids.store2).eq("title", PACK).single();
  return data!;
}
afterEach(async () => {
  if (!reachable) return;
  if (created.length) await svc().from("orders").delete().in("id", created.splice(0));
  await svc().from("listings").update({ quantity_on_hand: 1500, stock_status: "in_stock", low_stock_threshold: 50 }).eq("store_id", ids.store2).eq("title", PACK);
});
afterAll(async () => {
  if (!reachable) return;
  await svc().from("subscriptions").delete().eq("user_id", ids.seller1);
});

/* ───────── Plans (FLAME tiers) ───────── */
describe("FLAME membership tiers", () => {
  const tier = async (c: Client) => (await c.rpc("my_tier")).data![0];

  guarded("the tier comes from a subscription; admins grant and revoke; users can't grant themselves", async () => {
    const free = await as("seller1@marketplaceph.test");
    const pro = await as("seller2@marketplaceph.test");
    const admin = await as("admin@marketplaceph.test");
    expect((await tier(pro)).tier).toBe("pro");
    expect((await tier(free)).tier).toBe("apprentice");
    expect((await tier(free)).listing_limit).toBe(10);
    expect((await tier(admin)).listing_limit).toBeNull(); // Champion: unlimited
    expect((await anon().rpc("my_tier")).data ?? []).toEqual([]);
    expect((await free.rpc("assert_tier", { p_min: 1 })).error?.message).toMatch(/FLAME Starter or higher/i);
    expect((await pro.rpc("assert_tier", { p_min: 4 })).error).toBeNull();
    expect((await pro.rpc("assert_tier", { p_min: 5 })).error?.message).toMatch(/FLAME Champion/i);

    expect((await free.from("subscriptions").insert({ user_id: ids.seller1, plan: "champion", status: "active" })).error).not.toBeNull();
    expect((await free.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true })).error?.message).toMatch(/only an admin/i);
    expect((await free.rpc("request_plan", { p_tier: "apprentice" })).error?.message).toMatch(/unknown plan/i);
    expect((await free.rpc("request_plan", { p_tier: "neo", p_billing: "yearly", p_note: "Please enable Neo" })).error).toBeNull();
    const open = (await admin.from("plan_requests").select("user_id, plan, billing").eq("status", "open")).data!;
    expect(open.find((r) => r.user_id === ids.seller1)).toMatchObject({ plan: "neo", billing: "yearly" });

    expect((await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_days: 30, p_note: "test", p_tier: "micro", p_billing: "monthly" })).error).toBeNull();
    expect((await tier(free)).tier).toBe("micro");
    expect((await free.from("notifications").select("kind").eq("kind", "plan_activated")).data!.length).toBeGreaterThan(0);
    expect((await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_tier: "apprentice" })).error?.message).toMatch(/unknown plan/i);

    // an expired subscription falls back to Apprentice
    await svc().from("subscriptions").update({ current_period_end: new Date(Date.now() - 3600_000).toISOString() }).eq("user_id", ids.seller1);
    expect((await tier(free)).tier).toBe("apprentice");
    await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_days: 30, p_tier: "starter" });
    expect((await tier(free)).tier).toBe("starter");
    await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: false });
    expect((await tier(free)).tier).toBe("apprentice");
    // you only ever see your own subscription row, never other people's
    const mine = (await free.from("subscriptions").select("user_id")).data!;
    expect(mine.every((r) => r.user_id === ids.seller1)).toBe(true);
    expect((await (await as("seller1@marketplaceph.test")).from("plan_tiers").select("key")).data!.length).toBe(6);
  });

  guarded("each advanced feature unlocks at its own tier", async () => {
    const admin = await as("admin@marketplaceph.test");
    const seller = await as("seller1@marketplaceph.test");
    const TIERS = ["apprentice", "starter", "micro", "neo", "pro", "champion"];
    const gates: [string, number, () => PromiseLike<{ error: { message: string } | null }>][] = [
      ["long date range", 1, () => seller.rpc("finance_summary", { p_from: daysAgo(60), p_to: today() })],
      ["best sellers", 2, () => seller.rpc("seller_best_sellers", { p_store: ids.store1, p_from: daysAgo(10), p_to: today(), p_limit: 5 })],
      ["follow-up rules", 3, () => seller.rpc("save_follow_up_rule", { p_store: ids.store1, p_every: 30, p_message: "hi", p_buyer: ids.buyer })],
      ["profit & loss", 4, () => seller.rpc("finance_pl", { p_from: daysAgo(10), p_to: today() })],
      ["SMS setup", 4, () => seller.rpc("save_sms_settings", { p_phone: "+639171110000", p_enabled: false })],
    ];
    try {
      for (const [name, need, call] of gates) {
        for (let rank = 0; rank < TIERS.length; rank++) {
          if (rank === 0) await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: false });
          else await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: true, p_days: 1, p_tier: TIERS[rank] });
          const res = await call();
          expect(!!res.error && /Subscribe to enable it/i.test(res.error.message), `${name} at ${TIERS[rank]}`).toBe(rank < need);
          if (!res.error || rank >= need) expect(res.error, `${name} at ${TIERS[rank]}`).toBeNull();
        }
      }
    } finally {
      await admin.rpc("admin_set_plan", { p_user: ids.seller1, p_active: false });
      await svc().from("follow_up_rules").delete().eq("store_id", ids.store1);
      await svc().from("sms_settings").delete().eq("user_id", ids.seller1);
    }
  });

  guarded("the FLAME sync function is service-only and ends paid membership on apprentice", async () => {
    const seller = await as("seller1@marketplaceph.test");
    expect((await seller.rpc("sync_membership", { p_email: "seller1@marketplaceph.test", p_tier: "champion" })).error).not.toBeNull();
    expect((await anon().rpc("sync_membership", { p_email: "seller1@marketplaceph.test", p_tier: "champion" })).error).not.toBeNull();
    const ok = await svc().rpc("sync_membership", { p_email: "Seller1@MarketplacePH.test", p_tier: "neo", p_billing: "yearly", p_period_end: new Date(Date.now() + 86_400_000).toISOString() });
    expect(ok.data).toBe(true);
    expect((await seller.rpc("my_tier")).data![0].tier).toBe("neo");
    expect((await svc().rpc("sync_membership", { p_email: "nobody@example.com", p_tier: "neo" })).data).toBe(false);
    expect((await svc().rpc("sync_membership", { p_email: "seller1@marketplaceph.test", p_tier: "apprentice" })).data).toBe(true);
    expect((await seller.rpc("my_tier")).data![0].tier).toBe("apprentice");
  });
});

/* ───────── CRM & suppliers ───────── */
describe("CRM and supplier database", () => {
  guarded("seller sees customers built from orders, with totals; others can't", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const { data } = await seller.rpc("crm_list", { p_store: ids.store2 });
    expect(data!.length).toBeGreaterThanOrEqual(5);
    const me = data!.find((c) => c.buyer_id === ids.buyer)!;
    expect(me.display_name).toBe("Buyer Demo");
    expect(me.completed_count).toBeGreaterThanOrEqual(3);
    expect(Number(me.total_spent)).toBeGreaterThanOrEqual(26_400);
    expect(me.notes).toMatch(/Reseller in Pampanga/);
    expect(me.tags).toEqual(["reseller", "vip"]);
    expect(me.last_phone).toBe("09171112222");
    // sorted by most recent order
    const times = data!.map((c) => new Date(c.last_order_at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const other = await as("seller1@marketplaceph.test");
    expect((await other.rpc("crm_list", { p_store: ids.store2 })).error?.message).toMatch(/not your store/i);
    expect((await other.from("crm_customers").select("notes")).data).toEqual([]);
  });

  guarded("notes and tags are cleaned, capped, and only kept on real customers", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const ok = await seller.rpc("crm_save", { p_store: ids.store2, p_buyer: ids.seller3, p_notes: "  Calls before ordering  ", p_tags: ["  Wholesale ", "WHOLESALE", "", "gcash"] });
    expect(ok.error).toBeNull();
    const row = (await seller.from("crm_customers").select("notes, tags").eq("buyer_id", ids.seller3).single()).data!;
    expect(row.notes).toBe("Calls before ordering");
    expect([...row.tags].sort()).toEqual(["gcash", "wholesale"]);
    const tooMany = await seller.rpc("crm_save", { p_store: ids.store2, p_buyer: ids.seller3, p_notes: "x", p_tags: Array.from({ length: 11 }, (_, i) => `t${i}`) });
    expect(tooMany.error?.message).toMatch(/up to 10/i);
    // someone who never ordered or chatted
    expect((await seller.rpc("crm_save", { p_store: ids.store2, p_buyer: ids.admin, p_notes: "x", p_tags: [] })).error?.message).toMatch(/not one of your customers/i);
    expect((await (await as("seller1@marketplaceph.test")).rpc("crm_save", { p_store: ids.store2, p_buyer: ids.seller3, p_notes: "x", p_tags: [] })).error).not.toBeNull();
    await svc().from("crm_customers").delete().eq("buyer_id", ids.seller3).eq("store_id", ids.store2);
  });

  guarded("buyers get an automatic supplier list with their own private notes", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const { data } = await buyer.rpc("supplier_list");
    const s = data!.find((x) => x.store_id === ids.store2)!;
    expect(s.store_name).toBe("Cebu Sweet Mango Co.");
    expect(s.orders_count).toBeGreaterThanOrEqual(3);
    expect(Number(s.total_spent)).toBeGreaterThan(0);
    expect(s.favorite).toBe(true);
    expect(s.tags).toContain("dried-mango");
    expect(data![0].favorite).toBe(true); // favourites first
    // another user sees none of it
    expect((await (await as("seller3@marketplaceph.test")).from("supplier_notes").select("notes")).data).toEqual([]);
  });
});

/* ───────── Reports ───────── */
describe("reports and Pro gating", () => {
  guarded("sales summary numbers match the seeded deals (31-day range is free)", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const { data } = await seller.rpc("seller_sales_summary", { p_store: ids.store2, p_from: daysAgo(30), p_to: today() });
    const s = data![0];
    expect(s.orders_count).toBe(24);
    expect(Number(s.revenue)).toBe(211_200);
    expect(Number(s.items_sold)).toBe(2400);
    expect(Number(s.avg_order)).toBe(8800);
    expect(s.new_customers).toBeGreaterThanOrEqual(5);
    expect(s.repeat_customers).toBe(0); // all seeded deals are inside the window
    // someone else's store
    expect((await (await as("seller1@marketplaceph.test")).rpc("seller_sales_summary", { p_store: ids.store2, p_from: daysAgo(30), p_to: today() })).error?.message).toMatch(/not your store/i);
  });

  guarded("free users: short summaries only; trends, rankings and long ranges say 'Pro'", async () => {
    const free = await as("seller1@marketplaceph.test");
    expect((await free.rpc("seller_sales_summary", { p_store: ids.store1, p_from: daysAgo(30), p_to: today() })).error).toBeNull();
    const long = await free.rpc("seller_sales_summary", { p_store: ids.store1, p_from: daysAgo(90), p_to: today() });
    expect(long.error?.message).toMatch(/Subscribe to enable it/i);
    expect(long.error?.code).toBe("P0003");
    for (const call of [
      free.rpc("seller_sales_series", { p_store: ids.store1, p_from: daysAgo(30), p_to: today() }),
      free.rpc("seller_best_sellers", { p_store: ids.store1, p_from: daysAgo(30), p_to: today() }),
      free.rpc("seller_top_customers", { p_store: ids.store1, p_from: daysAgo(30), p_to: today() }),
      free.rpc("buyer_spend_by_supplier", { p_from: daysAgo(30), p_to: today() }),
      free.rpc("buyer_spend_by_category", { p_from: daysAgo(30), p_to: today() }),
      free.rpc("buyer_spend_series", { p_from: daysAgo(30), p_to: today() }),
      free.rpc("finance_pl", { p_from: daysAgo(30), p_to: today() }),
    ]) expect((await call).error?.message).toMatch(/Subscribe to enable it/i);
    expect((await free.rpc("buyer_spend_summary", { p_from: daysAgo(30), p_to: today() })).error).toBeNull();
    expect((await free.rpc("buyer_spend_summary", { p_from: daysAgo(60), p_to: today() })).error?.message).toMatch(/Subscribe to enable it/i);
    expect((await free.rpc("finance_summary", { p_from: daysAgo(90), p_to: today() })).error?.message).toMatch(/Subscribe to enable it/i);
    expect((await free.rpc("save_sms_settings", { p_phone: "09171234567", p_enabled: true })).error?.message).toMatch(/Subscribe to enable it/i);
    expect((await free.rpc("save_follow_up_rule", { p_store: ids.store1, p_buyer: ids.buyer, p_every: 30, p_message: "hi" })).error?.message).toMatch(/Subscribe to enable it/i);
  });

  guarded("Pro: trends, best sellers, top customers and any date range", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const series = await seller.rpc("seller_sales_series", { p_store: ids.store2, p_from: daysAgo(60), p_to: today(), p_bucket: "week" });
    expect(series.error).toBeNull();
    expect(series.data!.reduce((s, r) => s + Number(r.revenue), 0)).toBe(211_200);

    const top = (await seller.rpc("seller_top_customers", { p_store: ids.store2, p_from: daysAgo(60), p_to: today(), p_limit: 3 })).data!;
    expect(top.length).toBe(3);
    expect(Number(top[0].spent)).toBeGreaterThanOrEqual(Number(top[1].spent));

    // best sellers need item detail: give one completed deal real items, then rank
    const { data: deal } = await svc().from("orders").select("id").eq("store_id", ids.store2).eq("status", "completed").limit(1).single();
    await svc().from("order_items").insert({ order_id: deal!.id, title: PACK, unit: "pack", quantity: 100, unit_price: 88, available_qty: 100 });
    const best = (await seller.rpc("seller_best_sellers", { p_store: ids.store2, p_from: daysAgo(60), p_to: today() })).data!;
    expect(best[0]).toMatchObject({ title: PACK, qty: 100 });
    expect(Number(best[0].revenue)).toBe(8800);
    await svc().from("order_items").delete().eq("order_id", deal!.id);

    const buyer = await as("buyer@marketplaceph.test");
    const bySupplier = (await buyer.rpc("buyer_spend_by_supplier", { p_from: daysAgo(60), p_to: today() })).data!;
    expect(bySupplier.find((x) => x.store_id === ids.store2)).toBeTruthy();
    const byCat = (await buyer.rpc("buyer_spend_by_category", { p_from: daysAgo(60), p_to: today() })).data!;
    expect(byCat.length).toBeGreaterThan(0); // recorded deals (no item detail) at minimum
  });
});

/* ───────── Finance ───────── */
describe("simple finance", () => {
  guarded("entries are private; the summary adds sales, manual income, expenses and purchases", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const { data } = await seller.rpc("finance_summary", { p_from: daysAgo(30), p_to: today() });
    const f = data![0];
    expect(Number(f.manual_income)).toBe(7300);
    expect(Number(f.manual_expenses)).toBe(4850);
    expect(Number(f.order_income)).toBe(211_200);
    expect(Number(f.purchases)).toBe(0);
    expect(Number(f.net)).toBe(211_200 + 7300 - 4850);

    const other = await as("seller1@marketplaceph.test");
    expect((await other.from("expenses").select("id")).data).toEqual([]);
    expect((await other.from("income_entries").select("id")).data).toEqual([]);
    expect(Number((await other.rpc("finance_summary", { p_from: daysAgo(30), p_to: today() })).data![0].manual_expenses)).toBe(0);
    expect((await other.from("expenses").insert({ user_id: ids.seller2, entry_date: today(), amount: 5, category: "x1" })).error).not.toBeNull();
  });

  guarded("entries are validated; P&L groups by category (Pro)", async () => {
    const seller = await as("seller2@marketplaceph.test");
    expect((await seller.from("expenses").insert({ user_id: ids.seller2, entry_date: daysAgo(-30), amount: 10, category: "Packaging" })).error?.message).toMatch(/check the date/i);
    expect((await seller.from("expenses").insert({ user_id: ids.seller2, entry_date: today(), amount: -5, category: "Packaging" })).error).not.toBeNull();
    const pl = (await seller.rpc("finance_pl", { p_from: daysAgo(30), p_to: today() })).data!;
    const expenses = pl.filter((r) => r.section === "expense");
    expect(expenses.map((r) => r.category).sort()).toEqual(["Packaging", "Raw materials", "Transport"]);
    expect(Number(pl.find((r) => r.category === "Walk-in sales")!.amount)).toBe(7300);
    const sales = pl.find((r) => r.category === "Sales through MarketplacePH")!;
    expect(Number(sales.amount)).toBe(211_200);
    const income = pl.filter((r) => r.section === "income").reduce((s, r) => s + Number(r.amount), 0);
    const spend = expenses.reduce((s, r) => s + Number(r.amount), 0);
    expect(income - spend).toBe(211_200 + 7300 - 4850);
  });
});

/* ───────── Inventory ───────── */
describe("inventory", () => {
  async function paidOrder(qty: number) {
    const buyer = await as("buyer@marketplaceph.test");
    const seller = await as("seller2@marketplaceph.test");
    const l = await packListing();
    const { data: oid, error } = await buyer.rpc("place_order", {
      p_store: ids.store2, p_items: [{ listing_id: l.id, quantity: qty }],
      p_delivery: { recipient_name: "Buyer Demo", phone: "09171112222", address: "123 Sample St." },
    });
    if (error) throw new Error(error.message);
    created.push(oid as string);
    const { data: items } = await seller.from("order_items").select("id, quantity, unit_price").eq("order_id", oid as string);
    await seller.rpc("quote_order", { p_order: oid as string, p_items: items!.map((i) => ({ id: i.id, unit_price: i.unit_price, available_qty: i.quantity })), p_shipping_fee: 0 });
    await buyer.rpc("submit_payment", { p_order: oid as string, p_method: "gcash", p_reference: "REF-7777", p_amount: 1, p_proof_path: `${ids.buyer}/p.png` });
    return { buyer, seller, id: oid as string, listingId: l.id };
  }

  guarded("stock drops when payment is confirmed and returns if the order is cancelled", async () => {
    const { seller, id, listingId } = await paidOrder(100);
    expect((await packListing()).quantity_on_hand).toBe(1500); // not yet: payment not confirmed
    await seller.rpc("review_payment", { p_order: id, p_confirm: true });
    expect((await packListing()).quantity_on_hand).toBe(1400);
    const { data: log } = await seller.from("inventory_adjustments").select("delta, new_qty, reason").eq("listing_id", listingId).order("id", { ascending: false }).limit(1);
    expect(log![0]).toMatchObject({ delta: -100, new_qty: 1400, reason: "order_paid" });

    expect((await seller.rpc("cancel_order", { p_order: id, p_reason: "Supplier delay" })).error).toBeNull();
    expect((await packListing()).quantity_on_hand).toBe(1500);
    // and it can't be restored twice
    await svc().from("orders").update({ status: "cancelled" }).eq("id", id);
    expect((await packListing()).quantity_on_hand).toBe(1500);
  });

  guarded("low-stock alert fires once when stock crosses the threshold; zero flips to Out of stock and back", async () => {
    await svc().from("listings").update({ quantity_on_hand: 120, low_stock_threshold: 50 }).eq("store_id", ids.store2).eq("title", PACK);
    const first = await paidOrder(100);
    await first.seller.rpc("review_payment", { p_order: first.id, p_confirm: true });
    expect((await packListing()).quantity_on_hand).toBe(20);
    const alerts = (await first.seller.from("notifications").select("params").eq("kind", "low_stock")).data!;
    expect(alerts.some((a) => (a.params as { qty: number }).qty === 20)).toBe(true);
    await first.seller.rpc("cancel_order", { p_order: first.id, p_reason: "x" });

    await svc().from("listings").update({ quantity_on_hand: 100 }).eq("store_id", ids.store2).eq("title", PACK);
    const second = await paidOrder(100);
    await second.seller.rpc("review_payment", { p_order: second.id, p_confirm: true });
    const zero = await packListing();
    expect(zero).toMatchObject({ quantity_on_hand: 0, stock_status: "out_of_stock" });
    await second.seller.rpc("cancel_order", { p_order: second.id, p_reason: "x" });
    expect(await packListing()).toMatchObject({ quantity_on_hand: 100, stock_status: "in_stock" });
  });

  guarded("manual stock counts: owner only, validated and logged", async () => {
    const seller = await as("seller2@marketplaceph.test");
    const l = await packListing();
    expect((await (await as("seller1@marketplaceph.test")).rpc("adjust_stock", { p_listing: l.id, p_new_qty: 5 })).error?.message).toMatch(/not found/i);
    expect((await seller.rpc("adjust_stock", { p_listing: l.id, p_new_qty: -1 })).error?.message).toMatch(/0 or more/i);
    expect((await seller.rpc("adjust_stock", { p_listing: l.id, p_new_qty: 3, p_reason: "order_paid" })).error?.message).toMatch(/invalid reason/i);
    expect((await seller.rpc("adjust_stock", { p_listing: l.id, p_new_qty: 0, p_reason: "count" })).error).toBeNull();
    expect((await packListing()).stock_status).toBe("out_of_stock");
    expect((await seller.rpc("adjust_stock", { p_listing: l.id, p_new_qty: 40, p_reason: "count" })).error).toBeNull();
    expect(await packListing()).toMatchObject({ quantity_on_hand: 40, stock_status: "in_stock" });
    const log = (await seller.from("inventory_adjustments").select("delta, reason").eq("listing_id", l.id).order("id", { ascending: false }).limit(2)).data!;
    expect(log.map((x) => x.delta)).toEqual([40, -1500]);
    expect((await (await as("seller1@marketplaceph.test")).from("inventory_adjustments").select("id").eq("listing_id", l.id)).data).toEqual([]);
  });
});

/* ───────── Reminders & SMS ───────── */
describe("reminders", () => {
  const cleanup = { rules: [] as string[], orders: [] as string[] };
  afterEach(async () => {
    if (!reachable) return;
    const s = svc();
    if (cleanup.rules.length) await s.from("follow_up_rules").delete().in("id", cleanup.rules.splice(0));
    if (cleanup.orders.length) await s.from("orders").delete().in("id", cleanup.orders.splice(0));
    await s.from("follow_up_log").delete().eq("buyer_id", ids.admin);
    await s.from("sms_outbox").delete().eq("to_user", ids.admin);
    await s.from("reminder_optouts").delete().eq("user_id", ids.admin);
    await s.from("sms_settings").delete().eq("user_id", ids.seller2);
    await s.from("profiles").update({ accepts_sms: false, sms_phone: null }).eq("id", ids.admin);
    await s.from("notifications").delete().eq("user_id", ids.admin);
    await s.from("restock_reminders").delete().eq("title", "Test restock");
  });

  /** A customer (the admin account) whose last completed deal at store2 was 10 days ago and who has nothing open. */
  async function oldCustomer() {
    const { data } = await svc().from("orders").insert({
      store_id: ids.store2, seller_id: ids.seller2, buyer_id: ids.admin, summary: "Old deal", quantity: 10, amount: 500,
      status: "completed", confirmed_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    }).select("id").single();
    cleanup.orders.push(data!.id);
  }

  guarded("only the daily job (service role) can run reminders; your own reminders are free and sent in-app", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    expect((await buyer.rpc("run_due_reminders")).error).not.toBeNull();
    expect((await anon().rpc("run_due_reminders")).error).not.toBeNull();

    const ins = await buyer.from("restock_reminders").insert({ user_id: ids.buyer, title: "Test restock", store_id: ids.store2, every_days: 14, next_run_at: new Date(Date.now() - 60_000).toISOString() }).select("id").single();
    expect(ins.error).toBeNull();
    const before = (await buyer.from("notifications").select("id").eq("kind", "restock_self")).data!.length;
    const run = (await svc().rpc("run_due_reminders")).data![0];
    expect(run.self_sent).toBeGreaterThanOrEqual(1);
    expect((await buyer.from("notifications").select("id").eq("kind", "restock_self")).data!.length).toBe(before + 1);
    const after = (await buyer.from("restock_reminders").select("next_run_at, last_sent_at").eq("id", ins.data!.id).single()).data!;
    expect(new Date(after.next_run_at).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect(after.last_sent_at).not.toBeNull();
    // not sent twice
    expect((await svc().rpc("run_due_reminders")).data![0].self_sent).toBe(0);
    // private
    expect((await (await as("seller1@marketplaceph.test")).from("restock_reminders").select("id")).data).toEqual([]);
  });

  guarded("follow-ups: Pro sellers only, every 7+ days, once per customer per week, respect opt-outs and open orders", async () => {
    await oldCustomer();
    const seller = await as("seller2@marketplaceph.test");
    const tooOften = await seller.rpc("save_follow_up_rule", { p_store: ids.store2, p_buyer: ids.admin, p_every: 3, p_message: "x" });
    expect(tooOften.error?.message).toMatch(/7 to 365/);
    expect((await seller.rpc("save_follow_up_rule", { p_store: ids.store2, p_every: 30, p_message: "x" })).error?.message).toMatch(/customer or a product/i);
    expect((await seller.rpc("save_follow_up_rule", { p_store: ids.store2, p_buyer: U(11), p_every: 30, p_message: "x" })).error?.message).toMatch(/not one of your customers/i);

    const rule = await seller.rpc("save_follow_up_rule", { p_store: ids.store2, p_buyer: ids.admin, p_every: 7, p_message: "Time to restock po!" });
    expect(rule.error).toBeNull();
    cleanup.rules.push(rule.data as string);

    const admin = await as("admin@marketplaceph.test");
    const r1 = (await svc().rpc("run_due_reminders")).data![0];
    expect(r1.follow_ups_sent).toBeGreaterThanOrEqual(1);
    const note = (await admin.from("notifications").select("params, link").eq("kind", "restock_follow_up")).data!;
    expect(note.length).toBe(1);
    expect(note[0].params).toMatchObject({ slug: "cebu-sweet-mango-co", message: "Time to restock po!" });
    expect(r1.sms_queued).toBe(0); // buyer never opted in to SMS
    expect((await svc().from("sms_outbox").select("id").eq("to_user", ids.admin)).data).toEqual([]);

    // no repeat within the window
    expect((await svc().rpc("run_due_reminders")).data![0].follow_ups_sent).toBe(0);
    // the seller sees what was sent, and the customer can opt out
    expect((await seller.from("follow_up_log").select("id").eq("buyer_id", ids.admin)).data!.length).toBe(1);
    await svc().from("follow_up_log").delete().eq("buyer_id", ids.admin);
    expect((await admin.from("reminder_optouts").insert({ user_id: ids.admin, store_id: ids.store2 })).error).toBeNull();
    expect((await svc().rpc("run_due_reminders")).data![0].follow_ups_sent).toBe(0);
    await admin.from("reminder_optouts").delete().eq("user_id", ids.admin);

    // a customer with an order in progress is not nagged
    const { data: open } = await svc().from("orders").insert({ store_id: ids.store2, seller_id: ids.seller2, buyer_id: ids.admin, summary: "Open order", quantity: 1, amount: 1, status: "requested", is_full_flow: true }).select("id").single();
    cleanup.orders.push(open!.id);
    expect((await svc().rpc("run_due_reminders")).data![0].follow_ups_sent).toBe(0);
  });

  guarded("a rule whose owner lost Pro stops sending", async () => {
    await oldCustomer();
    const { data: rule } = await svc().from("follow_up_rules").insert({ store_id: ids.store1, buyer_id: ids.admin, every_days: 7 }).select("id").single();
    cleanup.rules.push(rule!.id);
    // store1's owner (seller1) is Free; the admin has no orders there anyway, so also make the data valid
    const { data: o } = await svc().from("orders").insert({ store_id: ids.store1, seller_id: ids.seller1, buyer_id: ids.admin, summary: "Old deal", quantity: 1, amount: 100, status: "completed", confirmed_at: new Date(Date.now() - 20 * 86_400_000).toISOString() }).select("id").single();
    cleanup.orders.push(o!.id);
    await svc().rpc("run_due_reminders");
    const hits = (await svc().from("follow_up_log").select("id").eq("rule_id", rule!.id)).data!;
    expect(hits).toEqual([]);
  });

  guarded("SMS is queued only when the seller has set it up (Pro) AND the customer opted in", async () => {
    await oldCustomer();
    const seller = await as("seller2@marketplaceph.test");
    expect((await seller.rpc("save_sms_settings", { p_phone: "12345", p_enabled: true })).error?.message).toMatch(/valid Philippine mobile/i);
    expect((await seller.rpc("save_sms_settings", { p_phone: "0917 123 4567", p_enabled: true })).error).toBeNull();
    const settings = (await seller.from("sms_settings").select("phone, enabled, accepted_terms_at").single()).data!;
    expect(settings).toMatchObject({ phone: "+639171234567", enabled: true });
    expect(settings.accepted_terms_at).not.toBeNull();

    const rule = await seller.rpc("save_follow_up_rule", { p_store: ids.store2, p_buyer: ids.admin, p_every: 7, p_message: "Restock na po?" });
    cleanup.rules.push(rule.data as string);

    // customer has not opted in → in-app only
    expect((await svc().rpc("run_due_reminders")).data![0].sms_queued).toBe(0);
    await svc().from("follow_up_log").delete().eq("buyer_id", ids.admin);

    // customer opts in → SMS is queued (not sent: no provider is connected)
    await svc().from("profiles").update({ accepts_sms: true, sms_phone: "+639175550000" }).eq("id", ids.admin);
    expect((await svc().rpc("run_due_reminders")).data![0].sms_queued).toBe(1);
    const { data: sms } = await svc().from("sms_outbox").select("to_phone, status, body, provider").eq("to_user", ids.admin).single();
    expect(sms).toMatchObject({ to_phone: "+639175550000", status: "queued", provider: null });
    expect(sms!.body).toMatch(/Restock na po/);
    expect(sms!.body).toMatch(/Opt out/);
    // the sender and the recipient can see the row; strangers cannot
    expect((await seller.from("sms_outbox").select("id")).data!.length).toBeGreaterThan(0);
    expect((await (await as("seller3@marketplaceph.test")).from("sms_outbox").select("id")).data).toEqual([]);
  });
});
