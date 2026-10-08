import { ShieldCheck, Store, Truck } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/listing/category-icon";
import { ListingGrid } from "@/components/listing/listing-card";
import { buttonClass } from "@/components/ui/button";
import { getCategories, getFeaturedStores, getLatestListings } from "@/lib/data";
import { imageUrl } from "@/lib/images";
import { getT } from "@/lib/i18n/server";

export default async function Home() {
  const { locale, t } = await getT();
  const [categories, latest, featured] = await Promise.all([getCategories(), getLatestListings(12), getFeaturedStores(6)]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-brand-sky p-6 text-white md:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-white/80">{t("brand.name")}</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight md:text-5xl">{t("brand.tagline")}</h1>
        <p className="mt-3 max-w-xl text-base text-white/90 md:text-lg">{t("brand.hook")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/sell/new" className={buttonClass("accent", "lg")}>
            {t("home.cta_post")}
          </Link>
          <Link href="/search" className={buttonClass("outline", "lg", "border-white/0")}>
            {t("home.cta_browse")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="cats">
        <h2 id="cats" className="mb-3 text-xl font-bold text-brand-dark">
          {t("home.categories")}
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={`/search?category=${c.slug}`}
                className="flex h-full flex-col items-center gap-2 rounded-2xl border border-border bg-white p-3 text-center text-xs font-semibold text-brand-dark transition-colors hover:border-brand hover:bg-brand-soft"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
                  <CategoryIcon name={c.icon} />
                </span>
                {locale === "fil" ? c.name_fil : c.name_en}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="featured">
          <h2 id="featured" className="mb-3 text-xl font-bold text-brand-dark">★ {t("home.featured")}</h2>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {featured.map((s) => (
              <li key={s.id} className="w-56 shrink-0">
                <Link href={`/store/${s.slug}`} className="flex h-full items-center gap-3 rounded-2xl border border-border bg-white p-3 hover:border-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logo_url ? imageUrl(s.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border border-border bg-white object-contain" />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-brand-dark">{s.name}</span>
                    {s.tagline && <span className="block truncate text-xs text-muted-foreground">{s.tagline}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="latest">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="latest" className="text-xl font-bold text-brand-dark">
            {t("home.latest")}
          </h2>
          <Link href="/search" className="text-sm font-semibold text-brand hover:underline">
            {t("home.see_all")}
          </Link>
        </div>
        <ListingGrid items={latest} t={t} />
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label={t("home.why")}>
        {[
          { icon: Store, title: t("home.why1_title"), body: t("home.why1_body") },
          { icon: ShieldCheck, title: t("home.why2_title"), body: t("home.why2_body") },
          { icon: Truck, title: t("home.why3_title"), body: t("home.why3_body") },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl bg-accent-soft p-5">
            <Icon className="text-accent-strong" aria-hidden />
            <h3 className="mt-2 font-bold text-brand-dark">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
