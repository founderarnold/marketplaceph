/**
 * Social layer + end-to-end messaging, against the LOCAL Supabase stack with seed data.
 * buyer = U(2), seller1 = U(3) (Apprentice), seller2 = U(4) (Pro, owns store2 "Cebu Sweet Mango Co."), seller3 = U(5).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { buyer: U(2), seller1: U(3), seller2: U(4), seller3: U(5), store2: S(2) };

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

const people = [ids.buyer, ids.seller1, ids.seller2, ids.seller3];
async function cleanup() {
  const db = svc();
  await db.from("follows").delete().in("follower_id", people);
  await db.from("user_updates").delete().in("author_id", people);
  await db.from("comments").delete().in("author_id", people);
  await db.from("badge_requests").delete().in("user_id", people);
  await db.from("user_badges").delete().in("user_id", people);
  await db.from("featured_pins").delete().in("user_id", people);
  await db.from("profiles").update({ role: "user" }).eq("id", ids.seller3);
  await db.from("notifications").delete().in("user_id", people).in("kind", ["new_friend", "new_comment", "new_review", "badge_approved", "badge_rejected"]);
}
afterAll(async () => {
  if (reachable) await cleanup();
});

async function aListing(store: string) {
  const { data } = await anon().from("listings").select("id, title").eq("store_id", store).eq("status", "active").limit(1).single();
  return data!;
}

describe("suki friends", () => {
  guarded("one tap adds a friend, counts are public, the list is private, and both-ways means suki", async () => {
    await cleanup();
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");

    expect((await buyer.from("follows").insert({ follower_id: ids.buyer, followee_id: ids.seller2 })).error).toBeNull();
    // can't add on someone else's behalf, or add yourself
    expect((await buyer.from("follows").insert({ follower_id: ids.seller3, followee_id: ids.seller2 })).error).not.toBeNull();
    expect((await buyer.from("follows").insert({ follower_id: ids.buyer, followee_id: ids.buyer })).error).not.toBeNull();

    let c = (await anon().rpc("friend_counts", { p_user: ids.seller2 })).data![0];
    expect(c).toMatchObject({ friends: 1, suki: 0 });
    // the seller is told, and only the two of them can see the link
    expect((await seller2.from("notifications").select("kind").eq("kind", "new_friend")).data!.length).toBeGreaterThan(0);
    expect((await seller3.from("follows").select("follower_id").eq("followee_id", ids.seller2)).data).toEqual([]);
    expect((await seller2.from("follows").select("follower_id").eq("followee_id", ids.seller2)).data).toHaveLength(1);

    await seller2.from("follows").insert({ follower_id: ids.seller2, followee_id: ids.buyer });
    c = (await anon().rpc("friend_counts", { p_user: ids.seller2 })).data![0];
    expect(c).toMatchObject({ friends: 1, following: 1, suki: 1 });

    // removing works only for your own link
    await seller3.from("follows").delete().eq("follower_id", ids.buyer).eq("followee_id", ids.seller2);
    expect((await anon().rpc("friend_counts", { p_user: ids.seller2 })).data![0].friends).toBe(1);
    await buyer.from("follows").delete().eq("follower_id", ids.buyer).eq("followee_id", ids.seller2);
    expect((await anon().rpc("friend_counts", { p_user: ids.seller2 })).data![0].friends).toBe(0);
  });

  guarded("friends feed shows a friend's updates and new items; strangers' posts don't appear", async () => {
    await cleanup();
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");
    const mine = await aListing(ids.store2);

    expect((await seller2.from("user_updates").insert({ author_id: ids.seller2, body: "Fresh dried mango stock this week!", listing_id: mine.id })).error).toBeNull();
    // can't link someone else's listing, and banned words are blocked like listings
    expect((await seller3.from("user_updates").insert({ author_id: ids.seller3, body: "Look at this", listing_id: mine.id })).error?.message).toMatch(/own listing/);
    const banned = (await svc().from("banned_keywords").select("keyword").limit(1).single()).data!.keyword;
    expect((await seller3.from("user_updates").insert({ author_id: ids.seller3, body: `selling ${banned} cheap` })).error?.message).toMatch(/can't be posted/);

    // before adding: nothing from seller2
    expect((await buyer.rpc("friends_feed", {})).data!.filter((r) => r.actor_id === ids.seller2)).toEqual([]);
    await buyer.from("follows").insert({ follower_id: ids.buyer, followee_id: ids.seller2 });
    const feed = (await buyer.rpc("friends_feed", { p_limit: 60 })).data!;
    const upd = feed.find((r) => r.kind === "update" && r.actor_id === ids.seller2)!;
    expect(upd.body).toContain("Fresh dried mango");
    expect(upd.title).toBe("listing");
    expect(upd.link_slug).toBe(mine.id);
    // the feed is for signed-in people only
    expect((await anon().rpc("friends_feed", {})).error).not.toBeNull();
    // only the author (or staff) can delete an update
    await seller3.from("user_updates").delete().eq("id", upd.item_id);
    expect((await anon().from("user_updates").select("id").eq("id", upd.item_id)).data).toHaveLength(1);
    await seller2.from("user_updates").delete().eq("id", upd.item_id);
    expect((await anon().from("user_updates").select("id").eq("id", upd.item_id)).data).toEqual([]);
  });
});

describe("questions & comments", () => {
  guarded("anyone signed in can ask, the seller is notified, and only author / owner can delete", async () => {
    await cleanup();
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");
    const l = await aListing(ids.store2);

    const { data: c, error } = await buyer.from("comments").insert({ target_kind: "listing", target_id: l.id, author_id: ids.buyer, body: "Available pa po ba ang 100 packs?" }).select("id").single();
    expect(error).toBeNull();
    expect((await anon().from("comments").select("body").eq("id", c!.id)).data).toHaveLength(1); // public
    expect((await seller2.from("notifications").select("kind").eq("kind", "new_comment")).data!.length).toBeGreaterThan(0);
    expect((await anon().from("comments").insert({ target_kind: "listing", target_id: l.id, author_id: ids.buyer, body: "as a guest" })).error).not.toBeNull();
    // a stranger can't delete it; the seller (owner of the listing) can
    await seller3.from("comments").delete().eq("id", c!.id);
    expect((await anon().from("comments").select("id").eq("id", c!.id)).data).toHaveLength(1);
    await seller2.from("comments").delete().eq("id", c!.id);
    expect((await anon().from("comments").select("id").eq("id", c!.id)).data).toEqual([]);
    // comments need a real, active post
    expect((await buyer.from("comments").insert({ target_kind: "listing", target_id: "00000000-0000-0000-0000-000000000000", author_id: ids.buyer, body: "hello?" })).error?.message).toMatch(/not available/);
  });
});

describe("shop conversation, start to finish", () => {
  guarded("inquiry → reply → read → deal in chat → buyer confirms → buyer reviews the item", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test");
    const l = await aListing(ids.store2);
    const db = svc();
    await db.from("conversations").delete().eq("buyer_id", ids.buyer).eq("store_id", ids.store2).eq("listing_id", l.id);

    // 1. buyer opens a chat about the item and asks
    const { data: convo, error: cErr } = await buyer.from("conversations").insert({ buyer_id: ids.buyer, store_id: ids.store2, listing_id: l.id }).select("id").single();
    expect(cErr).toBeNull();
    expect((await buyer.from("messages").insert({ conversation_id: convo!.id, sender_id: ids.buyer, body: "Hi! How much for 200 packs delivered to Cebu City?" })).error).toBeNull();

    // 2. the seller sees it as unread in the header badge, reads it and replies
    const before = (await seller2.rpc("my_header_counts")).data![0].messages;
    expect(before).toBeGreaterThan(0);
    const inbox = (await seller2.from("messages").select("body, read_at").eq("conversation_id", convo!.id)).data!;
    expect(inbox[0].body).toContain("200 packs");
    await seller2.rpc("mark_conversation_read", { p_conv: convo!.id });
    expect((await seller2.rpc("my_header_counts")).data![0].messages).toBe(before - 1);
    await new Promise((r) => setTimeout(r, 1100)); // the chat speed limit allows one message a second per person
    expect((await seller2.from("messages").insert({ conversation_id: convo!.id, sender_id: ids.seller2, body: "₱88 each for 200 packs, free delivery within Cebu City." })).error).toBeNull();

    // 3. the buyer gets the reply
    const thread = (await buyer.from("messages").select("sender_id, body").eq("conversation_id", convo!.id).order("created_at")).data!;
    expect(thread.map((m) => m.sender_id)).toEqual([ids.buyer, ids.seller2]);

    // 4. the seller records the agreed deal in the chat; the buyer confirms it
    const { data: order, error: oErr } = await seller2.from("orders").insert({
      store_id: ids.store2, seller_id: ids.seller2, buyer_id: ids.buyer, conversation_id: convo!.id, listing_id: l.id, summary: "200 packs dried mango", quantity: 200, amount: 17600,
    }).select("id, status").single();
    expect(oErr).toBeNull();
    expect((await buyer.from("orders").select("id").eq("id", order!.id)).data).toHaveLength(1); // both sides see it
    expect((await buyer.from("orders").update({ status: "completed" }).eq("id", order!.id).select("status").single()).data?.status).toBe("completed");

    // 5. the buyer reviews; the review shows on the item page
    expect((await buyer.from("reviews").insert({ order_id: order!.id, reviewer_id: ids.buyer, rating: 5, comment: "Fresh, well packed, on time." } as never)).error).toBeNull();
    const reviews = (await anon().rpc("listing_reviews", { p_listing: l.id })).data!;
    expect(reviews.some((r) => r.comment === "Fresh, well packed, on time.")).toBe(true);

    await db.from("orders").delete().eq("id", order!.id);
    await db.from("conversations").delete().eq("id", convo!.id);
    await db.from("notifications").delete().in("user_id", [ids.buyer, ids.seller2]).eq("kind", "new_message");
  });
});

describe("reviews after a hiring", () => {
  guarded("only after 'hired', once each way, and strangers can't review", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const db = svc();
    await db.from("job_profiles").update({ consent_at: new Date().toISOString() }).eq("user_id", ids.buyer);
    const { data: post } = await employer.from("job_posts").insert({
      owner_id: ids.seller2, poster_type: "employer", company_name: "Review Test Co", title: "Store Helper", category: "retail",
      description: "Help arrange stock and assist customers in the store.", employment_type: "full_time", work_setup: "onsite",
    } as never).select("id").single();
    await seeker.rpc("apply_to_job", { p_post: post!.id });
    const app = (await employer.from("job_applications").select("id").eq("post_id", post!.id).single()).data!;

    expect((await seeker.from("job_reviews").insert({ application_id: app.id, reviewer_id: ids.buyer, rating: 5 })).error?.message).toMatch(/after a hiring/);
    await employer.rpc("set_application_status", { p_app: app.id, p_status: "hired" });

    expect((await seeker.from("job_reviews").insert({ application_id: app.id, reviewer_id: ids.buyer, rating: 5, comment: "Fair boss, paid on time." })).error).toBeNull();
    expect((await employer.from("job_reviews").insert({ application_id: app.id, reviewer_id: ids.seller2, rating: 4, comment: "Hardworking." })).error).toBeNull();
    expect((await seeker.from("job_reviews").insert({ application_id: app.id, reviewer_id: ids.buyer, rating: 1 })).error).not.toBeNull(); // once only
    expect((await stranger.from("job_reviews").insert({ application_id: app.id, reviewer_id: ids.seller3, rating: 1 })).error?.message).toMatch(/not part/);

    const emp = (await anon().rpc("job_rating", { p_user: ids.seller2, p_direction: "applicant_to_employer" })).data![0];
    expect(Number(emp.avg_rating)).toBeGreaterThan(0);
    expect(emp.review_count).toBeGreaterThan(0);

    await db.from("job_posts").delete().eq("id", post!.id);
    await db.from("notifications").delete().in("user_id", [ids.buyer, ids.seller2]).in("kind", ["new_review", "job_application_status", "job_application_received"]);
  });
});

describe("badges and featured", () => {
  guarded("members request, only admin / founder / webmaster approve, and the badge shows publicly", async () => {
    await cleanup();
    const buyer = await as("buyer@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");

    const { data: req, error } = await buyer.from("badge_requests").insert({ user_id: ids.buyer, badge: "verified_buyer", note: "I buy supplies weekly." }).select("id").single();
    expect(error).toBeNull();
    expect((await buyer.from("badge_requests").insert({ user_id: ids.buyer, badge: "verified_buyer" })).error?.code).toBe("23505"); // one pending at a time
    expect((await buyer.from("user_badges").insert({ user_id: ids.buyer, badge: "verified_buyer" })).error).not.toBeNull(); // can't self-grant
    expect((await buyer.rpc("review_badge_request", { p_id: req!.id, p_approve: true })).error?.message).toMatch(/Only an admin/);
    // other members can't see the request
    expect((await seller3.from("badge_requests").select("id").eq("id", req!.id)).data).toEqual([]);

    // a founder can approve
    await svc().from("profiles").update({ role: "founder" }).eq("id", ids.seller3);
    expect((await seller3.rpc("review_badge_request", { p_id: req!.id, p_approve: true, p_note: "Welcome!" })).error).toBeNull();
    expect((await anon().from("user_badges").select("badge").eq("user_id", ids.buyer)).data).toEqual([{ badge: "verified_buyer" }]);
    expect((await buyer.from("notifications").select("kind").eq("kind", "badge_approved")).data!.length).toBeGreaterThan(0);
    // a founder has admin powers elsewhere too
    expect((await seller3.from("featured_pins").insert({ user_id: ids.seller2, kind: "seller" })).error).toBeNull();
    expect((await buyer.from("featured_pins").insert({ user_id: ids.buyer, kind: "buyer" })).error).not.toBeNull();

    // the pinned seller comes first; the list is public
    const rows = (await anon().rpc("featured_users", { p_kind: "seller", p_limit: 5 })).data!;
    expect(rows[0]).toMatchObject({ user_id: ids.seller2, pinned: true });
    await cleanup();
  });
});

describe("profile social links", () => {
  guarded("owners set their links, everyone can read them, nobody else can change them, unsafe links are refused", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller3 = await as("seller3@marketplaceph.test");
    const links = [
      { kind: "facebook_page", value: "https://facebook.com/BuyerDemo" },
      { kind: "whatsapp", value: "+639171234567" },
    ];
    expect((await buyer.rpc("set_profile_links", { p_links: links })).error).toBeNull();
    expect((await anon().from("profile_links").select("kind, value").eq("user_id", ids.buyer).order("position")).data).toEqual(links);
    // someone else can't add to, edit or delete my links
    expect((await seller3.from("profile_links").insert({ user_id: ids.buyer, kind: "website", value: "https://scam.example" })).error).not.toBeNull();
    await seller3.from("profile_links").delete().eq("user_id", ids.buyer);
    expect((await anon().from("profile_links").select("id").eq("user_id", ids.buyer)).data).toHaveLength(2);
    // javascript: links never get stored, even bypassing the website
    expect((await buyer.rpc("set_profile_links", { p_links: [{ kind: "website", value: "javascript:alert(1)" }] })).error).not.toBeNull();
    expect((await anon().from("profile_links").select("id").eq("user_id", ids.buyer)).data).toHaveLength(2); // unchanged: the failed save rolled back
    await svc().from("profile_links").delete().eq("user_id", ids.buyer);
  });
});

describe("job progress in Messages + hiring confirmation", () => {
  guarded("apply → updates in the job chat → hired → applicant confirms → counts for both", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const stranger = await as("seller3@marketplaceph.test");
    const db = svc();
    await db.from("job_profiles").update({ consent_at: new Date().toISOString() }).eq("user_id", ids.buyer);
    const before = (await anon().rpc("transaction_counts", { p_user: ids.seller2 })).data![0].hires;
    const { data: post } = await employer.from("job_posts").insert({
      owner_id: ids.seller2, poster_type: "employer", company_name: "Confirm Test Co", title: "Delivery Rider", category: "retail",
      description: "Deliver orders around the city on our motorbike, full time.", employment_type: "full_time", work_setup: "onsite",
    } as never).select("id").single();
    await seeker.rpc("apply_to_job", { p_post: post!.id });
    const app = (await employer.from("job_applications").select("id").eq("post_id", post!.id).single()).data!;
    const thread = (await employer.from("job_threads").select("id").eq("application_id", app.id).single()).data!.id;

    // the employer sees the new application as a message right away
    const kinds = async () => ((await seeker.from("job_messages").select("system_kind").eq("thread_id", thread).eq("is_system", true).order("created_at")).data ?? []).map((m) => m.system_kind);
    expect(await kinds()).toEqual(["job.applied"]);

    // can't confirm before being hired, and nobody else can confirm
    expect((await seeker.rpc("confirm_hire", { p_app: app.id })).error?.message).toMatch(/after the employer marks you as hired/);
    await employer.rpc("set_application_status", { p_app: app.id, p_status: "interview" });
    await employer.rpc("set_application_status", { p_app: app.id, p_status: "hired" });
    expect((await stranger.rpc("confirm_hire", { p_app: app.id })).error).not.toBeNull();
    expect((await employer.rpc("confirm_hire", { p_app: app.id })).error).not.toBeNull();
    expect((await seeker.rpc("confirm_hire", { p_app: app.id })).error).toBeNull();

    expect(await kinds()).toEqual(["job.applied", "job.interview", "job.hired", "job.hire_confirmed"]);
    expect((await employer.from("notifications").select("kind").eq("kind", "hire_confirmed")).data!.length).toBeGreaterThan(0);
    expect((await anon().rpc("transaction_counts", { p_user: ids.seller2 })).data![0].hires).toBe(before + 1);
    expect((await anon().rpc("transaction_counts", { p_user: ids.buyer })).data![0].hired).toBeGreaterThan(0);
    // fake update cards are refused in the job chat too
    expect((await seeker.from("job_messages").insert({ thread_id: thread, sender_id: ids.buyer, body: "x", is_system: true, system_kind: "job.hired" } as never)).error).not.toBeNull();

    await db.from("job_posts").delete().eq("id", post!.id);
    await db.from("notifications").delete().in("user_id", [ids.buyer, ids.seller2]).in("kind", ["hire_confirmed", "job_application_status", "job_application_received"]);
  });
});

describe("Looking for board", () => {
  guarded("buyers post, sellers send private offers, the buyer accepts one and a chat opens", async () => {
    const buyer = await as("buyer@marketplaceph.test");
    const seller2 = await as("seller2@marketplaceph.test"); // store2
    const seller3 = await as("seller3@marketplaceph.test"); // has a store too
    const db = svc();
    const store3 = (await db.from("stores").select("id").eq("owner_id", ids.seller3).limit(1).single()).data!.id;

    // 1. the buyer posts a request; everyone can read it; nobody else can edit it
    const { data: rq, error } = await buyer.from("buy_requests").insert({
      buyer_id: ids.buyer, kind: "product", title: "Dried mango 100g packs for resale", quantity: 200, unit: "packs", budget_min: 80, budget_max: 95,
    }).select("id").single();
    expect(error).toBeNull();
    expect((await anon().from("buy_requests").select("title").eq("id", rq!.id).single()).data?.title).toContain("Dried mango");
    expect((await seller3.from("buy_requests").update({ title: "Hacked title here" }).eq("id", rq!.id).select("id")).data).toEqual([]);
    const banned = (await db.from("banned_keywords").select("keyword").limit(1).single()).data!.keyword;
    expect((await buyer.from("buy_requests").insert({ buyer_id: ids.buyer, title: `Looking for ${banned} supply` })).error?.message).toMatch(/can't be posted/);

    // 2. sellers send offers; you need a store, and can't offer on your own request
    expect((await buyer.from("buy_request_offers").insert({ request_id: rq!.id, seller_id: ids.buyer, store_id: ids.store2, message: "I can supply this" })).error?.message).toMatch(/your own request/);
    const other = (await seller2.from("buy_requests").insert({ buyer_id: ids.seller2, title: "Packaging boxes for mango" }).select("id").single()).data!;
    expect((await buyer.from("buy_request_offers").insert({ request_id: other.id, seller_id: ids.buyer, store_id: ids.store2, message: "I can supply this" })).error?.message).toMatch(/store first/);
    await db.from("buy_requests").delete().eq("id", other.id);
    const o2 = (await seller2.from("buy_request_offers").insert({ request_id: rq!.id, seller_id: ids.seller2, store_id: ids.store2, unit_price: 88, quantity: 200, delivery_days: 3, message: "₱88 each, free delivery in Cebu City." }).select("id").single());
    expect(o2.error).toBeNull();
    const o3 = (await seller3.from("buy_request_offers").insert({ request_id: rq!.id, seller_id: ids.seller3, store_id: store3, unit_price: 92, message: "We can do ₱92 per pack." }).select("id").single());
    expect(o3.error).toBeNull();
    expect((await seller2.from("buy_request_offers").insert({ request_id: rq!.id, seller_id: ids.seller2, store_id: ids.store2, message: "Second try offer" })).error?.code).toBe("23505");

    // 3. offers are private: the buyer sees both, each seller only their own, guests none; the count is public
    expect((await buyer.from("buy_request_offers").select("id").eq("request_id", rq!.id)).data).toHaveLength(2);
    expect((await seller3.from("buy_request_offers").select("id").eq("request_id", rq!.id)).data).toHaveLength(1);
    expect((await anon().from("buy_request_offers").select("id").eq("request_id", rq!.id)).data).toEqual([]);
    expect((await anon().rpc("request_offer_counts", { p_ids: [rq!.id] })).data).toEqual([{ request_id: rq!.id, offers: 2 }]);
    expect((await buyer.from("notifications").select("kind").eq("kind", "new_offer")).data!.length).toBeGreaterThan(0);

    // 4. a seller can't accept their own offer; only the buyer decides
    expect((await seller2.from("buy_request_offers").update({ status: "accepted" }).eq("id", o2.data!.id)).error?.message).toMatch(/Invalid offer status/);
    expect((await seller2.rpc("respond_to_offer", { p_offer: o2.data!.id, p_accept: true })).error?.message).toMatch(/not found/);

    // 5. the buyer accepts one (chat opens with an update card) and declines the other
    const { data: convo, error: aErr } = await buyer.rpc("respond_to_offer", { p_offer: o2.data!.id, p_accept: true });
    expect(aErr).toBeNull();
    expect((await seller2.from("messages").select("system_kind").eq("conversation_id", convo as string).eq("system_kind", "request.accepted")).data!.length).toBeGreaterThan(0);
    expect((await seller2.from("notifications").select("kind").eq("kind", "offer_accepted")).data!.length).toBeGreaterThan(0);
    expect((await buyer.rpc("respond_to_offer", { p_offer: o3.data!.id, p_accept: false })).error).toBeNull();
    expect((await seller3.from("buy_request_offers").select("status").eq("id", o3.data!.id).single()).data?.status).toBe("declined");

    // 6. once closed, no new offers
    await buyer.from("buy_requests").update({ status: "fulfilled" }).eq("id", rq!.id);
    await db.from("buy_request_offers").delete().eq("id", o3.data!.id);
    expect((await seller3.from("buy_request_offers").insert({ request_id: rq!.id, seller_id: ids.seller3, store_id: store3, message: "Still available?" })).error?.message).toMatch(/no longer taking offers/);

    await db.from("messages").delete().eq("system_kind", "request.accepted");
    await db.from("buy_requests").delete().eq("buyer_id", ids.buyer);
    await db.from("notifications").delete().in("user_id", [ids.buyer, ids.seller2, ids.seller3]).in("kind", ["new_offer", "offer_accepted", "offer_declined"]);
  });
});
