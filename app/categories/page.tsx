import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryDirectory } from "@/components/listing/category-directory";
import { CATEGORY_TABS, buildTree, type CategoryTab } from "@/lib/categories";
import { getCategories } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { FlameAdSlot } from "@/components/ads/flame-ad-slot";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every Buy/Sell category on MarketplacePH: products, suppliers, services and negosyo opportunities.",
};

export default function CategoriesPage(props: PageProps<"/categories">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Directory searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Directory({ searchParams }: Pick<PageProps<"/categories">, "searchParams">) {
  const sp = await searchParams;
  const { locale, t } = await getT();
  const tab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const majors = buildTree(await getCategories());
  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("cat.page_title")}</h1>
        <p className="text-muted-foreground">{t("cat.page_sub")}</p>
      </header>
      <FlameAdSlot slot="CATEGORY_TOP" category={tab || "all-categories"} />
      <CategoryDirectory majors={majors} locale={locale} initialTab={(CATEGORY_TABS as readonly string[]).includes(tab ?? "") ? (tab as CategoryTab) : "all"} />
    </div>
  );
}
