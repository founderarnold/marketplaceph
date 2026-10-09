/** Buy/Sell category tree: 30 major categories in 4 discovery tabs, each with sub-categories (see scripts/build-taxonomy-migration.cjs). */
export const CATEGORY_TABS = ["products", "suppliers", "services", "negosyo"] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

export type Cat = {
  id: string;
  slug: string;
  name_en: string;
  name_fil: string;
  icon: string | null;
  parent_id: string | null;
  tab: CategoryTab;
  sort_order: number;
};
export type Major = Cat & { children: Cat[] };

export const LISTING_CONDITIONS = ["new", "used", "refurbished", "surplus"] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const nameOf = (c: Pick<Cat, "name_en" | "name_fil">, locale: string) => (locale === "fil" ? c.name_fil : c.name_en);

/** Majors in display order, each with its sub-categories in display order. Orphans (parent missing) are ignored. */
export function buildTree(cats: Cat[]): Major[] {
  const byParent = new Map<string, Cat[]>();
  for (const c of cats) if (c.parent_id) byParent.set(c.parent_id, [...(byParent.get(c.parent_id) ?? []), c]);
  return cats
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ ...m, children: (byParent.get(m.id) ?? []).sort((a, b) => a.sort_order - b.sort_order) }));
}

/** The category's own id plus its sub-categories' ids, so a search for "Food & Beverages" also finds "Coffee". null = unknown slug. */
export function categoryIdsFor(cats: Cat[], slug: string): string[] | null {
  const c = cats.find((x) => x.slug === slug);
  if (!c) return null;
  return [c.id, ...cats.filter((x) => x.parent_id === c.id).map((x) => x.id)];
}

/** [major] or [major, sub] for breadcrumbs. */
export function pathTo(cats: Cat[], slug: string): Cat[] {
  const c = cats.find((x) => x.slug === slug);
  if (!c) return [];
  const parent = c.parent_id ? cats.find((x) => x.id === c.parent_id) : null;
  return parent ? [parent, c] : [c];
}

/** Case-insensitive match on English and Filipino names; a major also matches when one of its sub-categories does. */
export function filterTree(tree: Major[], query: string, locale: string): Major[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;
  const hit = (c: Cat) => c.name_en.toLowerCase().includes(q) || c.name_fil.toLowerCase().includes(q) || nameOf(c, locale).toLowerCase().includes(q);
  return tree.flatMap((m) => {
    if (hit(m)) return [m];
    const subs = m.children.filter(hit);
    return subs.length ? [{ ...m, children: subs }] : [];
  });
}
