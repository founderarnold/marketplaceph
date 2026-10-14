import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

/** Shown for unknown URLs and for listings/stores that were removed or never existed. */
export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-border bg-white p-8 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <SearchX size={32} aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold text-brand-dark">{t("notfound.title")}</h1>
      <p className="text-muted-foreground">{t("notfound.body")}</p>
      <form action="/search" role="search" className="flex gap-2">
        <input name="q" type="search" aria-label={t("search.placeholder")} placeholder={t("search.placeholder")} className="h-11 min-w-0 flex-1 rounded-xl border border-border px-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40" />
        <button className={buttonClass("accent")}>{t("search.button")}</button>
      </form>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonClass("primary")}>{t("notfound.home")}</Link>
        <Link href="/categories" className={buttonClass("outline")}>{t("nav.all_categories")}</Link>
      </div>
    </div>
  );
}
