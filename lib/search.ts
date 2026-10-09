import { LISTING_CONDITIONS, type ListingCondition } from "@/lib/categories";
import { SELLER_TYPES, STOCK_STATUSES, type SellerType } from "@/lib/domain";

export type SearchFilters = {
  q: string;
  category: string | null; // category slug
  region: string | null;
  province: string | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  sellerType: SellerType | null;
  verifiedOnly: boolean;
  inStockOnly: boolean;
  condition: ListingCondition | null;
  sort: "new" | "price_asc" | "price_desc";
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const PAGE_SIZE = 24;

export function parseSearchParams(sp: Raw): SearchFilters {
  const sellerType = one(sp.seller_type);
  const sort = one(sp.sort);
  const page = Math.floor(Number(one(sp.page)));
  return {
    // strip characters that have meaning in PostgREST filter syntax
    q: (one(sp.q) ?? "").replace(/[,()%*\\]/g, " ").trim().slice(0, 80),
    category: one(sp.category) || null,
    region: one(sp.region) || null,
    province: one(sp.province) || null,
    city: one(sp.city) || null,
    minPrice: num(one(sp.min)),
    maxPrice: num(one(sp.max)),
    sellerType: SELLER_TYPES.includes(sellerType as SellerType) ? (sellerType as SellerType) : null,
    verifiedOnly: one(sp.verified) === "1",
    inStockOnly: one(sp.in_stock) === "1",
    condition: LISTING_CONDITIONS.includes(one(sp.condition) as ListingCondition) ? (one(sp.condition) as ListingCondition) : null,
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "new",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 200) : 1,
  };
}

/** Minimal shape of the PostgREST builder we use, so this stays unit-testable. */
export interface FilterBuilder<T> {
  or(f: string): T;
  eq(c: string, v: unknown): T;
  gte(c: string, v: unknown): T;
  lte(c: string, v: unknown): T;
  in(c: string, v: unknown[]): T;
  order(c: string, o?: { ascending?: boolean; nullsFirst?: boolean }): T;
  range(a: number, b: number): T;
}

/** `categoryIds` (the category and its sub-categories) must be resolved from the slug by the caller. */
export function applyFilters<T extends FilterBuilder<T>>(query: T, f: SearchFilters, categoryIds: string[] | null): T {
  let q = query;
  if (f.q) q = q.or(`title.ilike.%${f.q}%,description.ilike.%${f.q}%`);
  if (categoryIds?.length) q = q.in("category_id", categoryIds);
  if (f.condition) q = q.eq("condition", f.condition);
  if (f.region) q = q.eq("region_code", f.region);
  if (f.province) q = q.eq("province_code", f.province);
  if (f.city) q = q.eq("city_code", f.city);
  if (f.minPrice != null) q = q.gte("price_min", f.minPrice);
  if (f.maxPrice != null) q = q.lte("price_min", f.maxPrice);
  if (f.sellerType) q = q.eq("stores.seller_type", f.sellerType);
  if (f.verifiedOnly) q = q.gte("stores.verification_level", 2);
  if (f.inStockOnly) q = q.in("stock_status", STOCK_STATUSES.filter((s) => s !== "out_of_stock"));
  if (f.sort === "price_asc") q = q.order("price_min", { ascending: true, nullsFirst: false });
  else if (f.sort === "price_desc") q = q.order("price_min", { ascending: false, nullsFirst: false });
  else q = q.order("created_at", { ascending: false });
  const from = (f.page - 1) * PAGE_SIZE;
  return q.range(from, from + PAGE_SIZE - 1);
}
