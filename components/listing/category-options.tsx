import { buildTree, nameOf, type Cat } from "@/lib/categories";

/**
 * <option> list for a category <select>: one group per major category, the major itself first ("All of …" / "… (general)"),
 * then its sub-categories. Works for filters (value = slug) and the listing form (value = id).
 */
export function CategoryOptions({ categories, locale, valueOf, majorLabel }: { categories: Cat[]; locale: string; valueOf: "slug" | "id"; majorLabel: (name: string) => string }) {
  return (
    <>
      {buildTree(categories).map((m) => (
        <optgroup key={m.id} label={nameOf(m, locale)}>
          <option value={m[valueOf]}>{majorLabel(nameOf(m, locale))}</option>
          {m.children.map((s) => (
            <option key={s.id} value={s[valueOf]}>
              {nameOf(s, locale)}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
