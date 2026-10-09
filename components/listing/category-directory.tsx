"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryIcon } from "@/components/listing/category-icon";
import { CATEGORY_TABS, filterTree, nameOf, type CategoryTab, type Major } from "@/lib/categories";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const CHIPS_COLLAPSED = 8;

/** Full directory: filter by tab, search across every category and sub-category, expand a card to see all of its sub-categories. */
export function CategoryDirectory({ majors, locale, initialTab }: { majors: Major[]; locale: string; initialTab: CategoryTab | "all" }) {
  const { t } = useT();
  const [tab, setTab] = useState<CategoryTab | "all">(initialTab);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => filterTree(majors.filter((m) => tab === "all" || m.tab === tab), q, locale), [majors, tab, q, locale]);
  const searching = q.trim().length > 0;
  const counts = useMemo(() => Object.fromEntries(CATEGORY_TABS.map((k) => [k, majors.filter((m) => m.tab === k).length])), [majors]);

  return (
    <div className="space-y-4">
      <div className="sticky top-[4.5rem] z-20 -mx-4 space-y-2 border-b border-border bg-white/95 px-4 py-3 backdrop-blur md:top-16">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("cat.find_ph")}
            aria-label={t("cat.find_ph")}
            className="h-12 w-full rounded-xl border border-border bg-white pl-10 pr-10 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={t("cat.clear")} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div role="tablist" aria-label={t("cat.tabs_label")} className="flex gap-1 overflow-x-auto text-sm font-semibold">
          {(["all", ...CATEGORY_TABS] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4", tab === k ? "border-brand bg-brand text-white" : "border-border bg-white text-brand-dark hover:bg-muted")}
            >
              {k === "all" ? t("cat.tab.all", { n: majors.length }) : `${t(`cat.tab.${k}`)} (${counts[k]})`}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">{t("cat.found", { n: tree.length })}</p>

      {tree.length === 0 ? (
        <div className="space-y-2 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("cat.none")}</p>
          <button type="button" onClick={() => { setQ(""); setTab("all"); }} className="text-sm font-semibold text-brand underline">{t("cat.reset")}</button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tree.map((m) => {
            const expanded = searching || open[m.id];
            const subs = expanded ? m.children : m.children.slice(0, CHIPS_COLLAPSED);
            return (
              <li key={m.id} className="space-y-3 rounded-2xl border border-border bg-white p-4">
                <Link href={`/search?category=${m.slug}`} className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><CategoryIcon name={m.icon} size={26} /></span>
                  <span className="min-w-0">
                    <span className="block font-bold leading-tight text-brand-dark">{nameOf(m, locale)}</span>
                    <span className="text-xs text-muted-foreground">{t("cat.see_all_in", { n: m.children.length })}</span>
                  </span>
                </Link>
                <ul className="flex flex-wrap gap-1.5">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <Link href={`/search?category=${s.slug}`} className="inline-flex min-h-9 items-center rounded-full border border-border bg-muted px-3 text-sm hover:border-brand hover:bg-brand-soft">
                        {nameOf(s, locale)}
                      </Link>
                    </li>
                  ))}
                  {!searching && m.children.length > CHIPS_COLLAPSED && (
                    <li>
                      <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} aria-expanded={!!open[m.id]} className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-brand underline">
                        {open[m.id] ? t("cat.less") : t("cat.more", { n: m.children.length - CHIPS_COLLAPSED })}
                      </button>
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
