import { NextResponse } from "next/server";
import { verifyHubMessage } from "@/lib/flame-sso";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * flameph.org's Sync button (My business listing, step 6) asks for one member's store: its public link and which
 * "Get your store ready" parts are done, so flameph.org can fill in the store link and give that member reward points.
 *
 * Server-to-server only, signed by the hub with this site's own key (purpose "store-summary", 2 minutes to live).
 * The member is named by their verified email, the same way the two sites match accounts at sign-in. Read only:
 * nothing here changes. Answers only the store link, its name and yes/no facts plus a product count; never contact
 * details, orders or anything private.
 */
const SITE = "https://www.marketplaceph.com";
const none = (activated = false) => NextResponse.json({ activated, store: null, profile: false, firstListing: false, payShip: false, verified: false, listingCount: 0 }, { headers: { "Cache-Control": "no-store" } });

/** The account with exactly this email (the auth admin search can return near matches, so the email is checked again). */
async function userIdFor(email: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!url || !key) return null;
  const r = await fetch(`${url}/auth/v1/admin/users?per_page=50&filter=${encodeURIComponent(email)}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(4000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => null)) as { users?: { id: string; email?: string; email_confirmed_at?: string | null }[] } | null;
  const u = (j?.users ?? []).find((x) => x.email?.toLowerCase() === email && x.email_confirmed_at);
  return u?.id ?? null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const c = typeof body?.token === "string" ? verifyHubMessage("store-summary", body.token) : null;
  const email = typeof c?.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!c || !/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return NextResponse.json({ error: "bad_request" }, { status: 401 });

  const uid = await userIdFor(email);
  if (!uid) return none(false);
  const admin = createAdminClient();
  const { data: store } = await admin.from("stores").select("id, slug, name, logo_url, description, contact_phone, verification_level")
    .eq("owner_id", uid).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!store) return none(true);
  const [listings, pay, ship, verif] = await Promise.all([
    admin.from("listings").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "active"),
    admin.from("store_payment_methods").select("id", { count: "exact", head: true }).eq("store_id", store.id),
    admin.from("store_shipping_methods").select("method_id", { count: "exact", head: true }).eq("store_id", store.id),
    admin.from("store_verifications").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "pending"),
  ]);
  const listingCount = listings.count ?? 0;
  // The same five parts as the seller's "Get your store ready" checklist (components/business/setup-checklist.tsx).
  return NextResponse.json({
    activated: true,
    store: { name: store.name, url: `${SITE}/store/${store.slug}` },
    profile: Boolean(store.logo_url && store.description && store.contact_phone),
    firstListing: listingCount > 0,
    payShip: (pay.count ?? 0) > 0 && (ship.count ?? 0) > 0,
    verified: (store.verification_level ?? 0) > 0 || (verif.count ?? 0) > 0,
    listingCount,
  }, { headers: { "Cache-Control": "no-store" } });
}
