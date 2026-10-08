"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

/** Plain GET form → works without JS and keeps the URL shareable. */
export function SearchBar({ className }: { className?: string }) {
  const { t } = useT();
  const sp = useSearchParams();
  return (
    <form action="/search" role="search" className={className}>
      <div className="relative">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          type="search"
          defaultValue={sp.get("q") ?? ""}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="h-11 w-full rounded-full border border-border bg-white pl-10 pr-4 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40"
        />
      </div>
    </form>
  );
}
