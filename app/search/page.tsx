import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingGrid } from "@/components/listing/listing-card";
import { SearchFiltersForm } from "@/components/listing/search-filters";
import { getCategories, getLocations } from "@/lib/data";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";
import { getT } from "@/lib/i18n/server";
import { applyFilters, PAGE_SIZE, parseSearchParams } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const filters = parseSearchParams(await searchParams);
  const { t } = await getT();
  const [categories, locations] = await Promise.all([getCategories(), getLocations()]);

  const categoryId = filters.category ? (categories.find((c) => c.slug === filters.category)?.id ?? null) : null;
  let items: ListingCardData[] = [];
  let total = 0;

  // An unknown category slug means "no results", not "everything".
  if (!filters.category || categoryId) {
    const supabase = await createClient();
    const base = supabase.from("listings").select(LISTING_CARD_SELECT, { count: "exact" }).eq("status", "active");
    const { data, count } = await applyFilters(base, filters, categoryId).overrideTypes<ListingCardData[], { merge: false }>();
    items = data ?? [];
    total = count ?? 0;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const usp = new URLSearchParams();
    const sp = {
      q: filters.q, category: filters.category, region: filters.region, province: filters.province, city: filters.city,
      min: filters.minPrice, max: filters.maxPrice, seller_type: filters.sellerType,
      verified: filters.verifiedOnly ? "1" : null, in_stock: filters.inStockOnly ? "1" : null,
      sort: filters.sort === "new" ? null : filters.sort, page: p > 1 ? p : null,
    };
    for (const [k, v] of Object.entries(sp)) if (v !== null && v !== "" && v !== undefined) usp.set(k, String(v));
    return `/search?${usp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark">
        {filters.q ? t("search.results_for", { q: filters.q }) : t("search.all")}
      </h1>
      <SearchFiltersForm filters={filters} categories={categories} locations={locations} />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("search.count", { n: total })}
      </p>
      <ListingGrid items={items} t={t} />
      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
          {filters.page > 1 && (
            <Link href={pageHref(filters.page - 1)} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted">
              ← {t("common.prev")}
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {filters.page} / {pages}
          </span>
          {filters.page < pages && (
            <Link href={pageHref(filters.page + 1)} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted">
              {t("common.next")} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
