import { cacheLife, cacheTag } from "next/cache";
import type { Cat } from "@/lib/categories";
import { createPublicClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";
import { REQUEST_CARD_SELECT, type RequestCardData } from "@/components/requests/request-card";

export type Category = Cat;
export type Locations = {
  regions: { code: string; name: string; short_name: string }[];
  provinces: { code: string; region_code: string; name: string }[];
  cities: { code: string; region_code: string; province_code: string | null; name: string }[];
};

// Public, cookie-free reads → safe to cache and prerender into the static shell.

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("categories");
  const { data } = await createPublicClient()
    .from("categories")
    .select("id, slug, name_en, name_fil, icon, parent_id, tab, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Cat[];
}

export async function getLocations(): Promise<Locations> {
  "use cache";
  cacheLife("days");
  const sb = createPublicClient();
  const [regions, provinces, cities] = await Promise.all([
    sb.from("psgc_regions").select("code, name, short_name").order("name"),
    sb.from("psgc_provinces").select("code, region_code, name").order("name"),
    sb.from("psgc_cities").select("code, region_code, province_code, name").order("name"),
  ]);
  return { regions: regions.data ?? [], provinces: provinces.data ?? [], cities: cities.data ?? [] };
}

export async function getLatestListings(limit = 12): Promise<ListingCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  const { data } = await createPublicClient()
    .from("listings")
    .select(LISTING_CARD_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<ListingCardData[], { merge: false }>();
  return data ?? [];
}

export type FeaturedStore = { id: string; slug: string; name: string; tagline: string | null; logo_url: string | null };

/** Champion-tier stores get a spot on the home page (stable daily rotation). */
export async function getFeaturedStores(limit = 6): Promise<FeaturedStore[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("featured-stores");
  const sb = createPublicClient();
  const { data: ids } = await sb.rpc("featured_stores", { p_limit: limit });
  const list = (ids ?? []).map((r) => r.store_id);
  if (!list.length) return [];
  const { data } = await sb.from("stores").select("id, slug, name, tagline, logo_url").in("id", list);
  return list.flatMap((id) => data?.find((s) => s.id === id) ?? []);
}

export type FeaturedUser = {
  user_id: string;
  name: string;
  subtitle: string | null;
  image: string | null;
  link: string;
  avg_rating: number | null;
  review_count: number;
  friends: number;
  badges: string[];
  verification_level: number;
  pinned: boolean;
};

/** Home page "Featured" rows: ranked by ratings, badges, suki friends and activity (admin pins first), refreshed every few minutes. */
export async function getFeaturedUsers(kind: "seller" | "buyer" | "applicant" | "employer", limit = 8): Promise<FeaturedUser[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("featured-users");
  const { data } = await createPublicClient().rpc("featured_users", { p_kind: kind, p_limit: limit });
  return (data ?? []) as FeaturedUser[];
}

/** Home page "Buyers are looking for": newest open requests with their offer counts (offers themselves stay private). */
export async function getOpenRequests(limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag("buy-requests");
  const sb = createPublicClient();
  const { data } = await sb
    .from("buy_requests")
    .select(REQUEST_CARD_SELECT)
    .eq("status", "open")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<RequestCardData[], { merge: false }>();
  const rows = data ?? [];
  const { data: counts } = rows.length ? await sb.rpc("request_offer_counts", { p_ids: rows.map((r) => r.id) }) : { data: [] };
  const offers = Object.fromEntries((counts ?? []).map((c) => [c.request_id, c.offers]));
  return rows.map((r) => ({ ...r, offers: (offers[r.id] as number | undefined) ?? 0 }));
}
