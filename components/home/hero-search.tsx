"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const SCOPES = [
  { key: "listings", action: "/search" },
  { key: "jobs", action: "/jobs" },
] as const;

/** The big home-page search. Scope tabs switch where the plain GET form goes, so it still works without JS (as a listings search). */
export function HeroSearch({ popular }: { popular: { href: string; label: string }[] }) {
  const { t } = useT();
  const [scope, setScope] = useState<(typeof SCOPES)[number]>(SCOPES[0]);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div role="radiogroup" aria-label={t("home.search_scope")} className="mb-3 flex items-center justify-center gap-6">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="radio"
            aria-checked={scope.key === s.key}
            onClick={() => setScope(s)}
            className={cn(
              "relative pb-1.5 text-lg font-extrabold transition-colors md:text-2xl",
              scope.key === s.key ? "text-accent-strong after:absolute after:inset-x-1/4 after:bottom-0 after:h-1 after:rounded-full after:bg-accent" : "text-brand-dark/70 hover:text-brand-dark",
            )}
          >
            {t(`home.scope.${s.key}`)}
          </button>
        ))}
      </div>
      <form action={scope.action} role="search" className="flex items-center gap-2 rounded-2xl border-2 border-accent bg-white p-2 shadow-lg shadow-accent/10">
        <input
          name="q"
          type="search"
          placeholder={t(`home.scope_placeholder.${scope.key}`)}
          aria-label={t(`home.scope_placeholder.${scope.key}`)}
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base focus:outline-none md:text-lg"
        />
        <button type="submit" className="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-[#fb923c] px-5 font-bold text-brand-dark hover:brightness-95 md:px-8">
          <Search size={20} aria-hidden /> <span className="hidden sm:inline">{t("search.button")}</span>
        </button>
      </form>
      {popular.length > 0 && (
        <p className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          <span className="shrink-0 text-muted-foreground">{t("home.popular")}</span>
          {popular.map((p) => (
            <Link key={p.href} href={p.href} className="shrink-0 whitespace-nowrap rounded-full border border-border bg-white px-3 py-1 font-medium text-brand-dark hover:border-brand hover:text-brand">
              {p.label}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
