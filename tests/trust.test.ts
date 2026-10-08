/**
 * Phase 2 integration tests: deals + reviews, trust metrics, badges, verification privacy,
 * and the report → case → decision → appeal → watchlist due-process workflow.
 * Uses the LOCAL Supabase stack. Each run creates its own fixtures and removes them afterwards.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { admin: U(1), buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5), store1: "10000000-0000-4000-8000-000000000001", store2: "10000000-0000-4000-8000-000000000002", store3: "10000000-0000-4000-8000-000000000003" };

type Client = SupabaseClient<Database>;
const anon = (): Client => createClient<Database>(URL, ANON, { auth: { persistSession: false } });
async function as(email: string): Promise<Client> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}
const svc = () => createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });

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

/** Make sure two accounts have chatted (deals can only be recorded after a real conversation). */
async function chat(buyerEmail: string, buyerId: string, storeId: string) {
  const b = await as(buyerEmail);
  const existing = await b.from("conversations").select("id").eq("store_id", storeId).is("listing_id", null).maybeSingle();
  const id = existing.data?.id ?? (await b.from("conversations").insert({ buyer_id: buyerId, store_id: storeId }).select("id").single()).data!.id;
  await b.from("messages").insert({ conversation_id: id, sender_id: buyerId, body: "Hello, interested po." });
  return id;
}

describe("trust metrics & badges (seed data)", () => {
  guarded("computes store trust metrics, with amounts only as ranges", async () => {
    const { data } = await anon().rpc("store_trust", { p_store: ids.store2 });
    const t = data![0];
    expect(t.completed_orders).toBe(24);
    expect(t.amount_label).toBe("₱100K–500K"); // 24 × ₱8,800 = ₱211,200
    expect(t.total_quantity).toBe(2400);
    expect(Number(t.avg_rating)).toBeCloseTo(4.88, 1);
    expect(t.review_count).toBe(24);
    expect(t.dispute_rate).toBe(0);
  });
  guarded("range buckets", async () => {
    const c = anon();
    const cases: [number, string][] = [[0, "₱0"], [9999, "Under ₱10K"], [10000, "₱10K–50K"], [99999, "₱50K–100K"], [100000, "₱100K–500K"], [750000, "₱500K–1M"], [2000000, "₱1M–5M"], [9000000, "₱5M+"]];
    for (const [n, label] of cases) expect((await c.rpc("amount_range", { n })).data, String(n)).toBe(label);
  });
  guarded("derives badges from live data", async () => {
    const c = anon();
    expect((await c.rpc("store_badges", { p_store: ids.store2 })).data).toContain("top_seller"); // 24 deals, 4.9★
    expect((await c.rpc("store_badges", { p_store: ids.store1 })).data).not.toContain("top_seller"); // 3 deals
    expect((await c.rpc("buyer_badges", { p_user: ids.buyer })).data).toContain("reliable_buyer");
  });
  guarded("buyer cancellation rate counts only cancellations by that buyer", async () => {
    const { data } = await anon().rpc("user_trust", { p_user: U(8) });
    expect(data![0].cancellation_rate).not.toBeNull();
    expect(Number(data![0].cancellation_rate)).toBeGreaterThan(0);
  });
});

describe("buyer information sheet privacy", () => {
  guarded("hidden unless the buyer opts in, or the viewer has chatted with them", async () => {
    expect((await anon().rpc("buyer_sheet", { p_user: ids.buyer })).data).toEqual([]);
    const self = await as("buyer@marketplaceph.test");
    expect((await self.rpc("buyer_sheet", { p_user: ids.buyer })).data!.length).toBe(1);
    const seller2 = await as("seller2@marketplaceph.test"); // has the seeded chat with this buyer
    expect((await seller2.rpc("buyer_sheet", { p_user: ids.buyer })).data!.length).toBe(1);
    const stranger = await as("seller3@marketplaceph.test");
    expect((await stranger.rpc("buyer_sheet", { p_user: ids.buyer })).data).toEqual([]);
  });
});

describe("deals + reviews", () => {
  const created: string[] = [];
  afterAll(async () => {
    if (reachable && created.length) await svc().from("orders").delete().in("id", created);
  });

  guarded("a deal needs a real conversation where the buyer has written", async () => {
    const s3 = await as("seller3@marketplaceph.test");
    const { error } = await s3.from("orders").insert({ store_id: ids.store3, seller_id: ids.seller3, buyer_id: ids.buyer, summary: "No chat yet", quantity: 1, amount: 100 });
    expect(error).not.toBeNull();
  });

  guarded("seller proposes → only the BUYER can confirm → then both can review (once)", async () => {
    const convo = await chat("buyer@marketplaceph.test", ids.buyer, ids.store1);
    const seller = await as("seller1@marketplaceph.test");
    const buyer = await as("buyer@marketplaceph.test");

    const { data: deal, error } = await seller
      .from("orders")
      .insert({ store_id: ids.store1, seller_id: ids.seller1, buyer_id: ids.buyer, conversation_id: convo, summary: "Test deal", quantity: 2, amount: 270, status: "completed" })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    created.push(deal!.id);
    expect(deal!.status).toBe("pending_confirmation"); // a seller cannot create a pre-completed deal

    // reviews are impossible before completion
    const early = await buyer.from("reviews").insert({ order_id: deal!.id, reviewer_id: ids.buyer, reviewee_id: ids.seller1, store_id: ids.store1, direction: "buyer_to_seller", rating: 5 });
    expect(early.error?.message).toMatch(/completed deal/i);

    // seller cannot confirm their own deal
    const self = await seller.from("orders").update({ status: "completed" }).eq("id", deal!.id);
    expect(self.error?.message).toMatch(/only the buyer/i);

    // buyer cannot edit amounts
    const edit = await buyer.from("orders").update({ amount: 1 }).eq("id", deal!.id);
    expect(edit.error?.message).toMatch(/cannot be edited/i);

    const ok = await buyer.from("orders").update({ status: "completed" }).eq("id", deal!.id).select("status, confirmed_at").single();
    expect(ok.data!.status).toBe("completed");
    expect(ok.data!.confirmed_at).not.toBeNull();

    // buyer → seller review (server fills direction/reviewee)
    const r1 = await buyer.from("reviews").insert({ order_id: deal!.id, reviewer_id: ids.buyer, reviewee_id: ids.buyer, store_id: ids.store1, direction: "seller_to_buyer", rating: 4, comment: "Good" }).select("direction, reviewee_id").single();
    expect(r1.data).toEqual({ direction: "buyer_to_seller", reviewee_id: ids.seller1 });
    // seller → buyer review
    const r2 = await seller.from("reviews").insert({ order_id: deal!.id, reviewer_id: ids.seller1, reviewee_id: ids.seller1, store_id: ids.store1, direction: "buyer_to_seller", rating: 5 }).select("direction").single();
    expect(r2.data!.direction).toBe("seller_to_buyer");
    // one review per person per deal
    const dup = await buyer.from("reviews").insert({ order_id: deal!.id, reviewer_id: ids.buyer, reviewee_id: ids.seller1, store_id: ids.store1, direction: "buyer_to_seller", rating: 1 });
    expect(dup.error).not.toBeNull();
    // outsiders cannot review
    const outsider = await as("seller3@marketplaceph.test");
    const out = await outsider.from("reviews").insert({ order_id: deal!.id, reviewer_id: ids.seller3, reviewee_id: ids.seller1, store_id: ids.store1, direction: "buyer_to_seller", rating: 1 });
    expect(out.error).not.toBeNull();
    // metrics move
    const t = (await anon().rpc("store_trust", { p_store: ids.store1 })).data![0];
    expect(t.completed_orders).toBe(4); // 3 seeded + this one
  });

  guarded("users can't delete reviews; reviews are public", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const { data: some } = await anon().from("reviews").select("id").limit(1);
    expect(some!.length).toBe(1);
    await buyer.from("reviews").delete().eq("id", some![0].id);
    expect((await anon().from("reviews").select("id").eq("id", some![0].id)).data!.length).toBe(1);
  });
});

describe("verification privacy", () => {
  guarded("documents are not readable by anyone via the API; owners can submit, not self-approve", async () => {
    const s3 = await as("seller3@marketplaceph.test");
    const admin = await as("admin@marketplaceph.test");
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

    // wrong folder is rejected
    expect((await s3.storage.from("private-docs").upload(`${ids.seller1}/id.png`, png)).error).not.toBeNull();
    const idPath = `${ids.seller3}/test-id-${Date.now()}.png`;
    const selfiePath = `${ids.seller3}/test-selfie-${Date.now()}.png`;
    expect((await s3.storage.from("private-docs").upload(idPath, png)).error).toBeNull();
    expect((await s3.storage.from("private-docs").upload(selfiePath, png)).error).toBeNull();

    // nobody (even the uploader or an admin) can list/download directly
    expect((await s3.storage.from("private-docs").download(idPath)).error).not.toBeNull();
    expect((await admin.storage.from("private-docs").download(idPath)).error).not.toBeNull();

    // a store at level 2 already can't request level 2 again; level 3 needs the right documents
    const missing = await s3.rpc("submit_verification", { p_store: ids.store3, p_target: 3, p_docs: [{ type: "dti", path: idPath }] });
    expect(missing.error).not.toBeNull();
    // someone else's store
    const notMine = await s3.rpc("submit_verification", { p_store: ids.store1, p_target: 3, p_docs: [{ type: "dti", path: idPath }] });
    expect(notMine.error?.message).toMatch(/not your store/i);
    // using another user's folder
    const stolen = await s3.rpc("submit_verification", { p_store: ids.store3, p_target: 3, p_docs: [
      { type: "dti", path: `${ids.seller1}/x.png` }, { type: "bir_cor", path: idPath }, { type: "mayors_permit", path: selfiePath }] });
    expect(stolen.error?.message).toMatch(/invalid document path/i);

    // regular users can't review verifications
    const s1 = await as("seller1@marketplaceph.test");
    const { data: ver } = await s3.rpc("submit_verification", { p_store: ids.store3, p_target: 3, p_docs: [
      { type: "dti", path: idPath }, { type: "bir_cor", path: idPath }, { type: "mayors_permit", path: selfiePath }] });
    // store3 is seeded at level 2 so this is a valid level-3 request
    expect(ver).toBeTruthy();
    const fake = await s1.rpc("review_verification", { p_id: ver as unknown as string, p_decision: "approved", p_note: "" });
    expect(fake.error?.message).toMatch(/admins only/i);
    expect((await s1.from("verification_documents").select("id")).data).toEqual([]);
    // owner can't flip their own level
    expect((await s3.from("stores").update({ verification_level: 3 }).eq("id", ids.store3)).error).not.toBeNull();

    // admin approves → level 3 + notification + documents scheduled for deletion
    expect((await admin.rpc("review_verification", { p_id: ver as unknown as string, p_decision: "approved", p_note: "ok" })).error).toBeNull();
    expect((await anon().from("stores").select("verification_level").eq("id", ids.store3).single()).data!.verification_level).toBe(3);
    const docs = await admin.from("verification_documents").select("retain_until").eq("verification_id", ver as unknown as string);
    expect(docs.data!.every((d) => d.retain_until !== null)).toBe(true);
    expect((await s3.from("notifications").select("kind").eq("kind", "verification_approved")).data!.length).toBeGreaterThan(0);

    // cleanup
    await svc().from("stores").update({ verification_level: 2 }).eq("id", ids.store3);
    await svc().from("store_verifications").delete().eq("id", ver as unknown as string);
    await svc().storage.from("private-docs").remove([idPath, selfiePath]);
  });
});

describe("reports → cases → watchlist (due process)", () => {
  const cleanup: { reports: string[] } = { reports: [] };
  afterAll(async () => {
    if (!reachable) return;
    const s = svc();
    if (cleanup.reports.length) {
      await s.from("watchlist_entries").delete().in("report_id", cleanup.reports);
      await s.from("reports").delete().in("id", cleanup.reports);
    }
    await s.from("profiles").update({ restricted_until: null }).eq("id", ids.seller1);
  });

  async function newReport(reporterEmail: string, reporterId: string, storeId: string, idx = 0) {
    const rep = await as(reporterEmail);
    const { data: l } = await anon().from("listings").select("id").eq("store_id", storeId).order("created_at").range(idx, idx).single();
    const r = await rep.from("reports").insert({ reporter_id: reporterId, target_type: "listing", target_id: l!.id, reason: "scam", details: "Took payment and vanished" }).select("id, accused_id").single();
    expect(r.error).toBeNull();
    cleanup.reports.push(r.data!.id);
    return r.data!;
  }

  guarded("reporting rules: not yourself, not twice, accused is resolved server-side", async () => {
    const own = await as("seller1@marketplaceph.test");
    const { data: l } = await anon().from("listings").select("id").eq("store_id", ids.store1).limit(1).single();
    expect((await own.from("reports").insert({ reporter_id: ids.seller1, target_type: "listing", target_id: l!.id, reason: "spam" })).error?.message).toMatch(/yourself/i);

    const rep = await newReport("buyer@marketplaceph.test", ids.buyer, ids.store1);
    expect(rep.accused_id).toBe(ids.seller1);
    const buyer = await as("buyer@marketplaceph.test");
    const dup = await buyer.from("reports").insert({ reporter_id: ids.buyer, target_type: "listing", target_id: l!.id, reason: "scam" });
    expect(dup.error?.message).toMatch(/already have an open report/i);
  });

  guarded("full workflow: cannot skip notice/response window; flag is neutral, appealable and revocable", async () => {
    await svc().from("notifications").delete().eq("user_id", ids.seller1); // isolate from earlier runs
    const rep = await newReport("seller3@marketplaceph.test", ids.seller3, ids.store1);
    const admin = await as("admin@marketplaceph.test");
    const accused = await as("seller1@marketplaceph.test");
    const reporter = await as("seller3@marketplaceph.test");

    // the accused sees nothing until a case is opened
    expect((await accused.rpc("cases_about_me")).data).toEqual([]);

    // cannot decide (other than dismiss) without notice
    const early = await admin.rpc("decide_case", { p_report: rep.id, p_outcome: "flagged", p_note: "x", p_gcash_name: "Juan Dela Cruz" });
    expect(early.error?.message).toMatch(/give the user a chance to respond/i);

    // moderators/regular users cannot open cases
    expect((await reporter.rpc("open_case", { p_report: rep.id, p_days: 7 })).error?.message).toMatch(/admins only/i);

    // open case → accused is notified and sees the allegation but NOT the reporter
    expect((await admin.rpc("open_case", { p_report: rep.id, p_days: 7 })).error).toBeNull();
    const mine = (await accused.rpc("cases_about_me")).data!;
    expect(mine.length).toBe(1);
    expect(Object.keys(mine[0])).not.toContain("reporter_id");
    expect((await accused.from("notifications").select("kind").eq("kind", "case_opened")).data!.length).toBe(1);
    // …and cannot read the reports table row (which has reporter_id)
    expect((await accused.from("reports").select("id").eq("id", rep.id)).data).toEqual([]);

    // window still open and no response → cannot decide
    const tooSoon = await admin.rpc("decide_case", { p_report: rep.id, p_outcome: "warning", p_note: "Please be careful" });
    expect(tooSoon.error?.message).toMatch(/window is still open/i);

    // a stranger cannot respond; the accused can, once
    expect((await reporter.rpc("submit_case_response", { p_report: rep.id, p_body: "I am not the accused" })).error).not.toBeNull();
    expect((await accused.rpc("submit_case_response", { p_report: rep.id, p_body: "I delivered; here is the receipt." })).error).toBeNull();
    expect((await accused.rpc("submit_case_response", { p_report: rep.id, p_body: "Second try should fail." })).error?.message).toMatch(/already responded/i);

    // decision needs a note for the user
    expect((await admin.rpc("decide_case", { p_report: rep.id, p_outcome: "flagged", p_note: "" })).error?.message).toMatch(/note/i);

    // flag it
    const flag = await admin.rpc("decide_case", { p_report: rep.id, p_outcome: "flagged", p_note: "Evidence shows non-delivery.", p_gcash_name: "Seller One Test", p_flag_months: 12 });
    expect(flag.error).toBeNull();

    // anyone can check by exact identifier; response is neutral (no allegation, no reporter)
    const hit = (await anon().rpc("check_before_pay", { p_query: "seller one test" })).data!;
    expect(hit.length).toBe(1);
    expect(Object.keys(hit[0]).sort()).toEqual(["expires_at", "flagged_at", "label", "match_kind"]);
    expect((await anon().rpc("check_before_pay", { p_query: "seller one" })).data).toEqual([]); // no partial matching
    expect((await anon().rpc("store_flag", { p_store: ids.store1 })).data).not.toBeNull();
    expect((await anon().from("watchlist_entries").select("id")).data).toEqual([]); // not browsable

    // reporter was told it is closed, accused told the outcome with an appeal deadline
    expect((await accused.from("notifications").select("params").eq("kind", "case_decided")).data!.length).toBe(1);

    // appeal → a different outcome path: appeals only from the accused; overturn revokes the flag
    expect((await reporter.rpc("file_appeal", { p_report: rep.id, p_body: "Not my case at all." })).error).not.toBeNull();
    expect((await accused.rpc("file_appeal", { p_report: rep.id, p_body: "I have the receipts, please review again." })).error).toBeNull();
    expect((await accused.rpc("file_appeal", { p_report: rep.id, p_body: "Duplicate appeal attempt." })).error).not.toBeNull();
    const { data: appeal } = await svc().from("appeals").select("id").eq("report_id", rep.id).single();
    expect((await accused.rpc("decide_appeal", { p_appeal: appeal!.id, p_outcome: "overturned", p_note: "" })).error?.message).toMatch(/only an admin/i);
    expect((await admin.rpc("decide_appeal", { p_appeal: appeal!.id, p_outcome: "overturned", p_note: "Receipts verified." })).error).toBeNull();
    expect((await anon().rpc("check_before_pay", { p_query: "seller one test" })).data).toEqual([]);
    expect((await anon().rpc("store_flag", { p_store: ids.store1 })).data).toBeNull();
  });

  guarded("temporary restriction blocks posting and chatting, then lifts", async () => {
    const rep = await newReport("buyer@marketplaceph.test", ids.buyer, ids.store1, 1);
    const admin = await as("admin@marketplaceph.test");
    const seller = await as("seller1@marketplaceph.test");
    await admin.rpc("open_case", { p_report: rep.id, p_days: 3 });
    await seller.rpc("submit_case_response", { p_report: rep.id, p_body: "Respectfully disputing this." });
    expect((await admin.rpc("decide_case", { p_report: rep.id, p_outcome: "restricted", p_note: "Pending review of delivery claims.", p_restrict_days: 3 })).error).toBeNull();

    const blocked = await seller.from("listings").insert({ store_id: ids.store1, title: "Should be blocked", price_type: "message" });
    expect(blocked.error?.message).toMatch(/temporarily restricted/i);
    const { data: convo } = await seller.from("conversations").select("id").limit(1);
    if (convo?.length) {
      const msg = await seller.from("messages").insert({ conversation_id: convo[0].id, sender_id: ids.seller1, body: "hi" });
      expect(msg.error?.message ?? "").toMatch(/temporarily restricted|not-null|violates|policy/i);
    }
    // overturned on appeal lifts it
    await seller.rpc("file_appeal", { p_report: rep.id, p_body: "The restriction is unfair; details attached." });
    const { data: appeal } = await svc().from("appeals").select("id").eq("report_id", rep.id).single();
    // the deciding admin may not decide their own case if another admin exists; here there is only one admin
    expect((await admin.rpc("decide_appeal", { p_appeal: appeal!.id, p_outcome: "overturned", p_note: "Lifted." })).error).toBeNull();
    const ok = await seller.from("listings").insert({ store_id: ids.store1, title: "Allowed again", price_type: "message" }).select("id").single();
    expect(ok.error).toBeNull();
    await svc().from("listings").delete().eq("id", ok.data!.id);
  });

  guarded("moderators can recommend but not publish flags", async () => {
    const rep = await newReport("seller3@marketplaceph.test", ids.seller3, ids.store2);
    const admin = await as("admin@marketplaceph.test");
    await svc().from("profiles").update({ role: "moderator" }).eq("id", ids.seller2);
    try {
      const mod = await as("seller2@marketplaceph.test");
      // (the moderator owns store2 here, so use a fresh path: they can only act on others' reports in practice)
      expect((await admin.rpc("open_case", { p_report: rep.id, p_days: 3 })).error).toBeNull();
      expect((await mod.rpc("decide_case", { p_report: rep.id, p_outcome: "flagged", p_note: "x" })).error?.message).toMatch(/only an admin can publish a flag/i);
    } finally {
      await svc().from("profiles").update({ role: "user" }).eq("id", ids.seller2);
    }
  });
});

describe("check-before-pay seed demo", () => {
  guarded("matches phone in any PH format and rejects tiny queries", async () => {
    for (const q of ["0917 000 9999", "+639170009999", "9170009999"]) {
      expect((await anon().rpc("check_before_pay", { p_query: q })).data!.length, q).toBe(1);
    }
    expect((await anon().rpc("check_before_pay", { p_query: "abc" })).data).toEqual([]);
    expect((await anon().rpc("check_before_pay", { p_query: "09170001111" })).data).toEqual([]);
  });
});
