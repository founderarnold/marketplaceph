"use client";

import { ChevronRight, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CategoryIcon } from "@/components/listing/category-icon";
import { CATEGORY_TABS, nameOf, type CategoryTab, type Major } from "@/lib/categories";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const HOME_LIMIT = 12;

/**
 * Home-page category browser: four discovery tabs (Shop Products / Find Suppliers / Find Services / Negosyo),
 * 12 tiles at a time with a few sample sub-categories on each tile, and a "View all categories" button.
 * Tabs follow the WAI-ARIA tab pattern (arrow keys move between them); tiles are plain links.
 */
export function CategoryExplorer({ majors, locale }: { majors: Major[]; locale: string }) {
  const { t } = useT();
  const [tab, setTab] = useState<CategoryTab>("products");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const inTab = majors.filter((m) => m.tab === tab);
  const shown = inTab.slice(0, HOME_LIMIT);

  function onKey(e: React.KeyboardEvent, i: number) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + CATEGORY_TABS.length) % CATEGORY_TABS.length;
    setTab(CATEGORY_TABS[next]);
    refs.current[next]?.focus();
  }

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label={t("cat.tabs_label")} className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1 text-sm font-semibold">
        {CATEGORY_TABS.map((k, i) => (
          <button
            key={k}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`cat-tab-${k}`}
            aria-selected={tab === k}
            aria-controls="cat-panel"
            tabIndex={tab === k ? 0 : -1}
            type="button"
            onClick={() => setTab(k)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn("min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 transition-colors", tab === k ? "bg-white text-brand shadow-sm" : "text-muted-foreground hover:text-brand-dark")}
          >
            {t(`cat.tab.${k}`)}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t(`cat.tab_hint.${tab}`)}</p>

      <ul id="cat-panel" role="tabpanel" aria-labelledby={`cat-tab-${tab}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((c) => (
          <li key={c.id}>
            <Link
              href={`/search?category=${c.slug}`}
              className="flex h-full min-h-32 flex-col items-center gap-1.5 rounded-2xl border border-border bg-white p-3 text-center transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <CategoryIcon name={c.icon} />
              </span>
              <span className="text-xs font-bold leading-tight text-brand-dark sm:text-sm">{nameOf(c, locale)}</span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{c.children.slice(0, 3).map((s) => nameOf(s, locale)).join(" · ")}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {inTab.length > HOME_LIMIT && <p className="text-sm text-muted-foreground">{t("cat.showing", { n: shown.length, total: inTab.length })}</p>}
        <Link href={`/categories?tab=${tab}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 font-bold text-white hover:bg-brand-dark">
          <LayoutGrid size={18} aria-hidden /> {t("cat.view_all")} <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
