import { Building2, BriefcaseBusiness, Megaphone, Search, ShieldCheck, ShoppingBag, Store, Truck, UserSearch } from "lucide-react";
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
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left pane: the business marketplace, laid out like the jobs pane: kicker, headline, plain sentence, three actions */}
        <section aria-labelledby="hero-biz" className="flex flex-col rounded-3xl bg-gradient-to-br from-brand-dark via-brand to-brand-sky p-6 text-white md:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
            <Store size={16} aria-hidden /> {t("brand.name")}
          </p>
          <h1 id="hero-biz" className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{t("brand.tagline")}</h1>
          <p className="mt-3 text-base text-white/90 md:text-lg">{t("brand.hook")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div className="flex flex-col rounded-2xl bg-white p-4 text-foreground shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand-dark"><Search size={18} aria-hidden /> {t("home.browse_title")}</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("home.browse_body")}</p>
              <Link href="/search" className={buttonClass("primary", "md", "mt-auto w-full")}>{t("home.cta_browse")}</Link>
            </div>
            <div className="flex flex-col rounded-2xl bg-white p-4 text-foreground shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand-dark"><ShoppingBag size={18} aria-hidden /> {t("home.buy_title")}</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("home.buy_body")}</p>
              <Link href="/search?in_stock=1&sort=price_asc" className={buttonClass("primary", "md", "mt-auto w-full")}>{t("home.cta_buy")}</Link>
            </div>
            <div className="flex flex-col rounded-2xl bg-white p-4 text-foreground shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand-dark"><Megaphone size={18} aria-hidden /> {t("home.sell_title")}</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("home.sell_body")}</p>
              <Link href="/sell/new" className={buttonClass("accent", "md", "mt-auto w-full")}>{t("home.cta_sell")}</Link>
            </div>
          </div>
        </section>

        {/* Right pane: jobs — job seekers and employers */}
        <section aria-labelledby="hero-jobs" className="flex flex-col rounded-3xl border-2 border-accent bg-accent-soft p-6 md:p-8">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent-strong">
            <BriefcaseBusiness size={16} aria-hidden /> {t("home.jobs_kicker")}
          </p>
          <h2 id="hero-jobs" className="mt-2 text-3xl font-extrabold leading-tight text-brand-dark md:text-4xl">{t("home.jobs_title")}</h2>
          <p className="mt-3 text-base text-foreground md:text-lg">{t("home.jobs_sub")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand-dark"><UserSearch size={18} aria-hidden /> {t("home.seeker_title")}</h3>
              <ul className="mb-4 mt-2 space-y-1 text-sm text-muted-foreground">
                <li>✓ {t("home.seeker_1")}</li>
                <li>✓ {t("home.seeker_2")}</li>
                <li>✓ {t("home.seeker_3")}</li>
              </ul>
              <Link href="/jobs" className={buttonClass("primary", "md", "mt-auto w-full")}>{t("home.seeker_cta")}</Link>
              <Link href="/jobs/profile" className="mt-2 text-center text-sm font-semibold text-brand underline">{t("home.seeker_cta2")}</Link>
            </div>
            <div className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-bold text-brand-dark"><Building2 size={18} aria-hidden /> {t("home.employer_title")}</h3>
              <ul className="mb-4 mt-2 space-y-1 text-sm text-muted-foreground">
                <li>✓ {t("home.employer_1")}</li>
                <li>✓ {t("home.employer_2")}</li>
                <li>✓ {t("home.employer_3")}</li>
              </ul>
              <Link href="/jobs/post" className={buttonClass("accent", "md", "mt-auto w-full")}>{t("home.employer_cta")}</Link>
              <Link href="/jobs/employer" className="mt-2 text-center text-sm font-semibold text-brand underline">{t("home.employer_cta2")}</Link>
            </div>
          </div>
        </section>
      </div>

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
