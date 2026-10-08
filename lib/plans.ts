/**
 * FLAME PH membership tiers. This is the ONE place that says what each tier includes, so the split is easy to change.
 * Real enforcement lives in the database (assert_tier / _range_ok / listing + affiliate triggers in supabase/migrations);
 * `plan_tiers` there holds the same fees and limits (tests/unit.test.ts checks the two agree).
 *
 * Billing is not connected yet: admins grant a tier manually (Admin → Plans) or FLAME PH syncs it (/api/flame/membership).
 * Fees come from the FLAME PH membership table. The post limits, affiliate-link limits and the tier → feature mapping are
 * product proposals: change them here AND in `plan_tiers` / the assert_tier(n) calls in the migration.
 */
export const TIER_KEYS = ["apprentice", "starter", "micro", "neo", "pro", "champion"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export type Tier = {
  key: TierKey;
  rank: number;
  name: string;
  monthly: number;
  yearly: number;
  /** null = unlimited */
  listings: number | null;
  affiliateLinks: number;
};

export const TIERS: readonly Tier[] = [
  { key: "apprentice", rank: 0, name: "FLAME Apprentice", monthly: 0, yearly: 0, listings: 10, affiliateLinks: 3 },
  { key: "starter", rank: 1, name: "FLAME Starter", monthly: 30, yearly: 300, listings: 30, affiliateLinks: 5 },
  { key: "micro", rank: 2, name: "FLAME Micro", monthly: 60, yearly: 600, listings: 100, affiliateLinks: 10 },
  { key: "neo", rank: 3, name: "FLAME Neo", monthly: 120, yearly: 1200, listings: 300, affiliateLinks: 25 },
  { key: "pro", rank: 4, name: "FLAME Pro", monthly: 360, yearly: 3600, listings: 1000, affiliateLinks: 50 },
  { key: "champion", rank: 5, name: "FLAME Champion", monthly: 720, yearly: 7700, listings: null, affiliateLinks: 200 },
];

export const tierByRank = (rank: number): Tier => TIERS[Math.min(Math.max(rank, 0), TIERS.length - 1)];
export const tierByKey = (key: string | null | undefined): Tier => TIERS.find((t) => t.key === key) ?? TIERS[0];

/** Feature → the lowest tier rank that includes it. Everything not listed here is free for every member. */
export const FEATURE_MIN_RANK = {
  // Apprentice (free, basic)
  customers: 0, // automatic customer list from orders, notes and tags
  suppliers: 0, // automatic supplier list, notes, favorites, quick reorder
  inventory: 0, // stock counts, low-stock alerts, auto "out of stock"
  own_reminders: 0, // your own in-app restock reminders
  finance_basic: 0, // income and expense entries + a simple monthly total
  reports_basic: 0, // sales / spending summaries for up to 31 days
  affiliates: 0, // up to 3 affiliate links (more per tier)
  // paid
  long_ranges: 1, // Starter: any date range
  csv_export: 1, // Starter: CSV exports
  reports_full: 2, // Micro: best sellers, top customers, trends, spending by supplier / category
  excel_export: 2, // Micro: Excel exports
  follow_ups: 3, // Neo: automatic restock follow-ups to your customers
  feed_export: 3, // Neo: product feed (CSV / JSON)
  embed: 3, // Neo: embeddable storefront widget / "Shop on MarketplacePH" button
  sms: 4, // Pro: SMS setup for reminders (opt-in recipients only)
  finance_pl: 4, // Pro: profit & loss by category over any date range
  pdf_export: 4, // Pro: PDF exports
  featured: 5, // Champion: featured placement on the home page
} as const;
export type Feature = keyof typeof FEATURE_MIN_RANK;

export const canUse = (rank: number, feature: Feature) => rank >= FEATURE_MIN_RANK[feature];
export const tierFor = (feature: Feature): Tier => tierByRank(FEATURE_MIN_RANK[feature]);

/** What each tier adds over the one below, for the comparison table (i18n keys: plan.feat_<feature>). */
export function featuresAddedAt(rank: number): Feature[] {
  return (Object.keys(FEATURE_MIN_RANK) as Feature[]).filter((f) => FEATURE_MIN_RANK[f] === rank);
}

/** Database error code assert_tier() / the listing + affiliate limits raise (see migrations). */
export const PRO_ERROR_CODE = "P0003";

export function isProError(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === PRO_ERROR_CODE || /Subscribe to enable|Upgrade your FLAME|FLAME Starter or higher/i.test(err.message ?? ""));
}

/** Yearly saving vs 12 months, as whole pesos (shown next to the yearly price). */
export const yearlySaving = (t: Tier) => Math.max(0, t.monthly * 12 - t.yearly);
