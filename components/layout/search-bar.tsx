"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Plain GET form → works without JS and keeps the URL shareable. */
export function SearchBar({ className }: { className?: string }) {
  const { t } = useT();
  const sp = useSearchParams();
  return (
    <form action="/search" role="search" className={cn("flex h-12 overflow-hidden rounded-full border-2 border-brand bg-white focus-within:ring-2 focus-within:ring-brand-sky/40", className)}>
      <input
        name="q"
        type="search"
        defaultValue={sp.get("q") ?? ""}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        className="min-w-0 flex-1 bg-transparent pl-4 pr-2 text-base focus:outline-none"
      />
      <button type="submit" aria-label={t("search.button")} className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold text-brand-dark hover:bg-[#ea6a0c] sm:px-5">
        <Search size={18} aria-hidden /> <span className="hidden sm:inline">{t("search.button")}</span>
      </button>
    </form>
  );
}
