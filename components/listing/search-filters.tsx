"use client";

import { SlidersHorizontal } from "lucide-react";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { CategoryOptions } from "@/components/listing/category-options";
import { LISTING_CONDITIONS } from "@/lib/categories";
import { Field, Input, Select } from "@/components/ui/field";
import type { Category, Locations } from "@/lib/data";
import { SELLER_TYPES } from "@/lib/domain";
import { useT } from "@/lib/i18n/client";
import type { SearchFilters } from "@/lib/search";

export function SearchFiltersForm({
  filters,
  categories,
  locations,
}: {
  filters: SearchFilters;
  categories: Category[];
  locations: Locations;
}) {
  const { t, locale } = useT();
  const active = [filters.category, filters.region, filters.minPrice, filters.maxPrice, filters.sellerType, filters.verifiedOnly, filters.inStockOnly, filters.condition].filter(
    (v) => v !== null && v !== false,
  ).length;

  return (
    <details className="group rounded-2xl border border-border bg-white" open={active > 0 ? true : undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-brand-dark">
        <SlidersHorizontal size={18} aria-hidden /> {t("filters.title")}
        {active > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold text-brand-dark">{active}</span>}
      </summary>
      <form action="/search" className="space-y-4 border-t border-border p-4">
        <input type="hidden" name="q" value={filters.q} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("filters.category")}>
            <Select name="category" defaultValue={filters.category ?? ""}>
              <option value="">{t("filters.all")}</option>
              <CategoryOptions categories={categories} locale={locale} valueOf="slug" majorLabel={(n) => t("cat.all_of", { name: n })} />
            </Select>
          </Field>
          <Field label={t("filters.seller_type")}>
            <Select name="seller_type" defaultValue={filters.sellerType ?? ""}>
              <option value="">{t("filters.all")}</option>
              {SELLER_TYPES.map((s) => (
                <option key={s} value={s}>
                  {t(`seller.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("cond.label")}>
            <Select name="condition" defaultValue={filters.condition ?? ""}>
              <option value="">{t("filters.all")}</option>
              {LISTING_CONDITIONS.map((c) => <option key={c} value={c}>{t(`cond.${c}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("filters.min_price")}>
            <Input name="min" type="number" inputMode="numeric" min={0} defaultValue={filters.minPrice ?? ""} placeholder="₱0" />
          </Field>
          <Field label={t("filters.max_price")}>
            <Input name="max" type="number" inputMode="numeric" min={0} defaultValue={filters.maxPrice ?? ""} placeholder="₱" />
          </Field>
        </div>
        <LocationSelect
          locations={locations}
          defaultValue={{ region: filters.region, province: filters.province, city: filters.city }}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="verified" value="1" defaultChecked={filters.verifiedOnly} className="h-5 w-5 accent-[var(--brand)]" />
            {t("filters.verified_only")}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="in_stock" value="1" defaultChecked={filters.inStockOnly} className="h-5 w-5 accent-[var(--brand)]" />
            {t("filters.in_stock_only")}
          </label>
          <Select name="sort" defaultValue={filters.sort} className="ml-auto w-auto" aria-label={t("filters.sort")}>
            <option value="new">{t("filters.sort_new")}</option>
            <option value="price_asc">{t("filters.sort_price_asc")}</option>
            <option value="price_desc">{t("filters.sort_price_desc")}</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{t("filters.apply")}</Button>
          <a href={`/search${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`} className="btn inline-flex h-11 items-center rounded-xl border border-border px-4 font-semibold hover:bg-muted">
            {t("filters.clear")}
          </a>
        </div>
      </form>
    </details>
  );
}
