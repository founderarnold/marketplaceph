/**
 * Integration tests: RLS + permissions + DB guards, against the LOCAL Supabase stack with seed data.
 * Run: `npx supabase db reset` then `npm test`. Skipped automatically when the stack is not reachable.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  buyer: "00000000-0000-4000-8000-000000000002",
  seller1: "00000000-0000-4000-8000-000000000003", // Kusina ni Aling Nena
  seller2: "00000000-0000-4000-8000-000000000004", // Cebu Sweet Mango Co.
  store1: "10000000-0000-4000-8000-000000000001",
  store2: "10000000-0000-4000-8000-000000000002",
  convo: "20000000-0000-4000-8000-000000000001", // buyer <-> store2
};

type Client = SupabaseClient<Database>;
const anon = (): Client => createClient<Database>(URL, ANON, { auth: { persistSession: false } });
async function as(email: string): Promise<Client> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}

let reachable = false;
beforeAll(async () => {
  try {
    const r = await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } });
    reachable = r.ok && !!ANON;
  } catch {
    reachable = false;
  }
});
const guarded = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!reachable) return ctx.skip();
    await fn();
  });

describe("public access (anon)", () => {
  guarded("can browse active listings and stores", async () => {
    const c = anon();
    const { data: l } = await c.from("listings").select("id").eq("status", "active");
    const { data: s } = await c.from("stores").select("id");
    expect(l!.length).toBeGreaterThan(20);
    expect(s!.length).toBeGreaterThanOrEqual(9);
  });
  guarded("cannot read profiles (phone/email stay private) but can read the public view", async () => {
    const c = anon();
    const { data: p } = await c.from("profiles").select("*");
    expect(p).toEqual([]);
    const { data: pub } = await c.from("public_profiles").select("id, display_name");
    expect(pub!.length).toBeGreaterThan(5);
    expect(Object.keys(pub![0]).sort()).toEqual(["display_name", "id"]);
  });
  guarded("cannot read chats, favorites, reports or audit logs", async () => {
    const c = anon();
    for (const table of ["conversations", "messages", "favorites", "reports", "audit_logs"] as const) {
      const { data } = await c.from(table).select("*");
      expect(data, table).toEqual([]);
    }
  });
  guarded("cannot post listings", async () => {
    const { error } = await anon().from("listings").insert({ store_id: ids.store1, title: "Hacked", price_type: "message" });
    expect(error).not.toBeNull();
  });
  guarded("private-docs storage: anonymous users can neither list nor upload", async () => {
    const c = anon();
    expect((await c.storage.from("private-docs").list()).data ?? []).toEqual([]);
    const up = await c.storage.from("private-docs").upload("x/id.pdf", new Blob(["x"], { type: "application/pdf" }));
    expect(up.error).not.toBeNull();
    // (signed-in owners may upload to their own folder; they can never read files back. See trust.test.ts)
  });
});

describe("chat privacy", () => {
  guarded("only the two participants can read a conversation", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const outsider = await as("seller1@marketplaceph.test");
    expect((await buyer.from("messages").select("id").eq("conversation_id", ids.convo)).data!.length).toBe(2);
    expect((await seller2.from("messages").select("id").eq("conversation_id", ids.convo)).data!.length).toBe(2);
    expect((await outsider.from("messages").select("id").eq("conversation_id", ids.convo)).data).toEqual([]);
    expect((await outsider.from("conversations").select("id").eq("id", ids.convo)).data).toEqual([]);
  });
  guarded("even admins cannot read private chats", async () => {
    const admin = await as("admin@marketplaceph.test");
    expect((await admin.from("messages").select("id")).data).toEqual([]);
  });
  guarded("an outsider cannot post into someone else's conversation", async () => {
    const outsider = await as("seller1@marketplaceph.test");
    const { error } = await outsider.from("messages").insert({ conversation_id: ids.convo, sender_id: ids.seller1, body: "hi" });
    expect(error).not.toBeNull();
  });
  guarded("cannot send as another user", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const { error } = await buyer.from("messages").insert({ conversation_id: ids.convo, sender_id: ids.seller2, body: "spoof" });
    expect(error).not.toBeNull();
  });
  guarded("a seller cannot open a chat with their own store", async () => {
    const s2 = await as("seller2@marketplaceph.test");
    const { error } = await s2.from("conversations").insert({ buyer_id: ids.seller2, store_id: ids.store2 });
    expect(error).not.toBeNull();
  });
  guarded("rate-limits message spam", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const existing = await buyer.from("conversations").select("id").eq("store_id", ids.store1).is("listing_id", null).maybeSingle();
    const convoId =
      existing.data?.id ??
      (await buyer.from("conversations").insert({ buyer_id: ids.buyer, store_id: ids.store1 }).select("id").single()).data!.id;
    let blocked = false;
    for (let i = 0; i < 25 && !blocked; i++) {
      const { error } = await buyer.from("messages").insert({ conversation_id: convoId, sender_id: ids.buyer, body: `spam ${i}` });
      if (error) {
        blocked = true;
        expect(error.message).toMatch(/too fast/i);
      }
    }
    expect(blocked).toBe(true);
    if (SERVICE) await createClient(URL, SERVICE).from("conversations").delete().eq("id", convoId); // cleanup (cascades messages)
  });
});

describe("seller permissions", () => {
  guarded("a seller cannot edit or delete another seller's listing", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { data: other } = await s1.from("listings").select("id").eq("store_id", ids.store2).limit(1).single();
    const upd = await s1.from("listings").update({ title: "defaced" }).eq("id", other!.id).select();
    expect(upd.data).toEqual([]);
    const del = await s1.from("listings").delete().eq("id", other!.id).select();
    expect(del.data).toEqual([]);
  });
  guarded("a seller cannot post into another seller's store", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { error } = await s1.from("listings").insert({ store_id: ids.store2, title: "Not my store", price_type: "message" });
    expect(error).not.toBeNull();
  });
  guarded("a seller cannot self-verify their store", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { error } = await s1.from("stores").update({ verification_level: 3 }).eq("id", ids.store1);
    expect(error?.message).toMatch(/admin/i);
  });
  guarded("a new store always starts unverified", async () => {
    const b = await as("buyer@marketplaceph.test");
    const slug = `test-store-${Date.now()}`;
    const { data, error } = await b
      .from("stores")
      .insert({ owner_id: ids.buyer, slug, name: "Buyer Test Store", seller_type: "reseller", verification_level: 3 })
      .select("verification_level")
      .single();
    expect(error).toBeNull();
    expect(data!.verification_level).toBe(0);
    await b.from("stores").delete().eq("slug", slug);
  });
  guarded("a user cannot promote themselves to admin", async () => {
    const b = await as("buyer@marketplaceph.test");
    const { error } = await b.from("profiles").update({ role: "admin" }).eq("id", ids.buyer);
    expect(error?.message).toMatch(/admins can change roles/i);
  });
  guarded("favorites are private to their owner", async () => {
    const b = await as("buyer@marketplaceph.test");
    const s1 = await as("seller1@marketplaceph.test");
    const { data: l } = await b.from("listings").select("id").limit(1).single();
    await b.from("favorites").insert({ user_id: ids.buyer, listing_id: l!.id });
    expect((await b.from("favorites").select("id")).data!.length).toBeGreaterThan(0);
    expect((await s1.from("favorites").select("id")).data).toEqual([]);
    const spoof = await s1.from("favorites").insert({ user_id: ids.buyer, listing_id: l!.id });
    expect(spoof.error).not.toBeNull();
    await b.from("favorites").delete().eq("user_id", ids.buyer);
  });
});

describe("listing rules", () => {
  guarded("blocks banned / prohibited items", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { error } = await s1.from("listings").insert({ store_id: ids.store1, title: "Used FIREARM for sale", price_type: "message" });
    expect(error?.message).toMatch(/cannot be listed/i);
  });
  guarded("flips to Out of stock automatically at quantity 0", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { data: created, error } = await s1
      .from("listings")
      .insert({ store_id: ids.store1, title: "Inventory rule test", price_type: "fixed", price_min: 10, quantity_on_hand: 5, stock_status: "in_stock" })
      .select("id, stock_status")
      .single();
    expect(error).toBeNull();
    expect(created!.stock_status).toBe("in_stock");
    const { data: updated } = await s1.from("listings").update({ quantity_on_hand: 0 }).eq("id", created!.id).select("stock_status").single();
    expect(updated!.stock_status).toBe("out_of_stock");
    await s1.from("listings").delete().eq("id", created!.id);
  });
  guarded("rejects inconsistent prices", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { error } = await s1.from("listings").insert({ store_id: ids.store1, title: "Bad range", price_type: "range", price_min: 100, price_max: 50 });
    expect(error).not.toBeNull();
  });
  guarded("hidden listings are invisible to the public but visible to the owner", async () => {
    const s1 = await as("seller1@marketplaceph.test");
    const { data: l } = await s1.from("listings").insert({ store_id: ids.store1, title: "Hidden thing", price_type: "message", status: "hidden" }).select("id").single();
    expect((await anon().from("listings").select("id").eq("id", l!.id)).data).toEqual([]);
    expect((await s1.from("listings").select("id").eq("id", l!.id)).data!.length).toBe(1);
    await s1.from("listings").delete().eq("id", l!.id);
  });
});

describe("moderation + audit", () => {
  guarded("an admin takedown is audit-logged and sellers cannot undo it", async () => {
    const admin = await as("admin@marketplaceph.test");
    const s1 = await as("seller1@marketplaceph.test");
    const { data: l } = await s1.from("listings").insert({ store_id: ids.store1, title: "Takedown test", price_type: "message" }).select("id").single();

    const { error } = await admin.from("listings").update({ status: "removed" }).eq("id", l!.id);
    expect(error).toBeNull();

    const { data: logs } = await admin.from("audit_logs").select("action, table_name, record_id, new_data").eq("record_id", l!.id);
    expect(logs!.some((x) => x.table_name === "listings" && x.action === "UPDATE")).toBe(true);

    const undo = await s1.from("listings").update({ status: "active" }).eq("id", l!.id);
    expect(undo.error?.message).toMatch(/removed by a moderator/i);

    if (SERVICE) await createClient(URL, SERVICE).from("listings").delete().eq("id", l!.id);
  });
  guarded("regular users cannot read audit logs or other people's reports", async () => {
    const b = await as("buyer@marketplaceph.test");
    const s1 = await as("seller1@marketplaceph.test");
    expect((await b.from("audit_logs").select("id")).data).toEqual([]);
    const { data: l } = await b.from("listings").select("id").limit(1).single();
    await b.from("reports").insert({ reporter_id: ids.buyer, target_type: "listing", target_id: l!.id, reason: "spam" });
    expect((await b.from("reports").select("id")).data!.length).toBeGreaterThan(0);
    expect((await s1.from("reports").select("id")).data).toEqual([]);
    const admin = await as("admin@marketplaceph.test");
    expect((await admin.from("reports").select("id")).data!.length).toBeGreaterThan(0);
    if (SERVICE) await createClient(URL, SERVICE).from("reports").delete().eq("reporter_id", ids.buyer);
  });
});
