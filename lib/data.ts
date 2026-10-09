import { cacheLife, cacheTag } from "next/cache";
import type { Cat } from "@/lib/categories";
import { createPublicClient } from "@/lib/supabase/server";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";

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
