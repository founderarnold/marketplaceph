import type { Metadata } from "next";
import { CategoryDirectory } from "@/components/listing/category-directory";
import { CATEGORY_TABS, buildTree, type CategoryTab } from "@/lib/categories";
import { getCategories } from "@/lib/data";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every Buy/Sell category on MarketplacePH: products, suppliers, services and negosyo opportunities.",
};

export default async function CategoriesPage({ searchParams }: PageProps<"/categories">) {
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
      <CategoryDirectory majors={majors} locale={locale} initialTab={(CATEGORY_TABS as readonly string[]).includes(tab ?? "") ? (tab as CategoryTab) : "all"} />
    </div>
  );
}
