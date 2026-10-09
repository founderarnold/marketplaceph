import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { categoryIdsFor, nameOf, pathTo } from "@/lib/categories";
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
  const { locale, t } = await getT();
  const [categories, locations] = await Promise.all([getCategories(), getLocations()]);

  const categoryIds = filters.category ? categoryIdsFor(categories, filters.category) : null;
  const trail = filters.category ? pathTo(categories, filters.category) : [];
  const current = trail[trail.length - 1];
  const chips = current ? categories.filter((c) => c.parent_id === (current.parent_id ?? current.id)) : [];
  let items: ListingCardData[] = [];
  let total = 0;

  // An unknown category slug means "no results", not "everything".
  if (!filters.category || categoryIds) {
    const supabase = await createClient();
    const base = supabase.from("listings").select(LISTING_CARD_SELECT, { count: "exact" }).eq("status", "active");
    const { data, count } = await applyFilters(base, filters, categoryIds).overrideTypes<ListingCardData[], { merge: false }>();
    items = data ?? [];
    total = count ?? 0;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const usp = new URLSearchParams();
    const sp = {
      q: filters.q, category: filters.category, region: filters.region, province: filters.province, city: filters.city,
      min: filters.minPrice, max: filters.maxPrice, seller_type: filters.sellerType,
      verified: filters.verifiedOnly ? "1" : null, in_stock: filters.inStockOnly ? "1" : null, condition: filters.condition,
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
      {trail.length > 0 && (
        <nav aria-label="Category path" className="space-y-2">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li><Link href="/categories" className="font-semibold text-brand hover:underline">{t("cat.all_categories")}</Link></li>
            {trail.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1">
                <ChevronRight size={14} aria-hidden />
                {i < trail.length - 1 ? <Link href={`/search?category=${c.slug}`} className="font-semibold text-brand hover:underline">{nameOf(c, locale)}</Link> : <span aria-current="page" className="font-bold text-brand-dark">{nameOf(c, locale)}</span>}
              </li>
            ))}
          </ol>
          {chips.length > 0 && (
            <ul className="flex gap-1.5 overflow-x-auto pb-1">
              {current && current.parent_id && (
                <li><Link href={`/search?category=${trail[0].slug}`} className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-border bg-white px-3 text-sm font-semibold hover:border-brand">{t("cat.all_of", { name: nameOf(trail[0], locale) })}</Link></li>
              )}
              {chips.map((c) => (
                <li key={c.id}><Link href={`/search?category=${c.slug}`} aria-current={c.slug === filters.category ? "true" : undefined} className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-3 text-sm ${c.slug === filters.category ? "border-brand bg-brand text-white" : "border-border bg-muted hover:border-brand hover:bg-brand-soft"}`}>{nameOf(c, locale)}</Link></li>
              ))}
            </ul>
          )}
        </nav>
      )}
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
