import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import {
  BadgeCheck, Building2, BriefcaseBusiness, ChevronRight, Heart, MessageCircle, Package, Plus, ShieldCheck, ShoppingBag, Store, Truck, UserSearch,
} from "lucide-react";
import Link from "next/link";
import { SignInButton } from "@/components/auth/auth-modal";
import { HeroSearch } from "@/components/home/hero-search";
import { CategoryIcon } from "@/components/listing/category-icon";
import { ListingGrid } from "@/components/listing/listing-card";
import { buttonClass } from "@/components/ui/button";
import { CATEGORY_TABS, buildTree, nameOf } from "@/lib/categories";
import { getCategories, getFeaturedStores, getFeaturedUsers, getLatestListings, getOpenRequests } from "@/lib/data";
import { RequestCard } from "@/components/requests/request-card";
import { FeaturedMembers } from "@/components/home/featured-members";
import { imageUrl } from "@/lib/images";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { FlameAdSlot } from "@/components/ads/flame-ad-slot";

// Soft tile backgrounds for the category cards, cycled so neighbouring tiles differ.
const TINTS = ["bg-brand-soft text-brand", "bg-accent-soft text-accent-strong", "bg-success-soft text-success", "bg-[#f3e8ff] text-[#6d28d9]"];

async function HomeContent() {
  const { locale, t } = await getT();
  const supabase = await createClient();
  const [{ data: auth }, categories, latest, featured, featuredUsers, requests] = await Promise.all([
    supabase.auth.getClaims(),
    getCategories(),
    getLatestListings(12),
    getFeaturedStores(6),
    Promise.all([getFeaturedUsers("seller"), getFeaturedUsers("employer"), getFeaturedUsers("applicant"), getFeaturedUsers("buyer")]),
    getOpenRequests(6),
  ]);
  const signedIn = !!auth?.claims;
  const majors = buildTree(categories);
  const productMajors = majors.filter((m) => m.tab === "products");
  const popular = productMajors.slice(0, 5).map((m) => ({ href: `/search?category=${m.slug}`, label: nameOf(m, locale) }));

  return (
    <div className="space-y-8">
      {/* ── 1. Search-first hero (like Alibaba): one job, find something ── */}
      <section aria-labelledby="hero" className="-mx-4 -mt-4 bg-gradient-to-b from-accent-soft via-white to-brand-soft/60 px-4 pb-8 pt-8 md:pt-12">
        <h1 id="hero" className="mx-auto mb-5 max-w-3xl text-center text-2xl font-extrabold leading-tight text-brand-dark md:text-4xl">
          {t("home.hero_title")}
        </h1>
        <HeroSearch popular={popular} />
      </section>

      <FlameAdSlot slot="HOME_AFTER_HERO" className="-mt-4" />

      {/* ── 2. Welcome strip with the trust shortcuts ── */}
      <section aria-label={t("home.welcome")} className="-mt-4 flex flex-col gap-3 rounded-2xl border border-border bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
        <p className="text-lg font-extrabold text-brand-dark">{t("home.welcome")}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-brand-dark">
          {[
            { href: "/sell/new", icon: Plus, label: t("nav.post_free") },
            { href: "/check", icon: ShieldCheck, label: t("home.quick_check") },
            { href: "/jobs", icon: BriefcaseBusiness, label: t("home.seeker_cta") },
            { href: "/jobs/post", icon: Building2, label: t("home.employer_cta") },
          ].map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-1.5 hover:text-brand hover:underline">
                <Icon size={18} className="text-accent-strong" aria-hidden /> {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3. Category sidebar | three intent tiles | account + promo (Alibaba/Amazon layout) ── */}
      <div className="grid gap-4 lg:grid-cols-[250px_1fr_280px]">
        <nav aria-labelledby="side-cats" className="hidden rounded-2xl border border-border bg-white p-2 lg:block">
          <h2 id="side-cats" className="px-3 pb-1 pt-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">{t("home.cats_for_you")}</h2>
          <ul className="max-h-[23rem] overflow-y-auto">
            {productMajors.map((m) => (
              <li key={m.id}>
                <Link href={`/search?category=${m.slug}`} className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground hover:bg-brand-soft hover:text-brand">
                  <span className="text-muted-foreground group-hover:text-brand"><CategoryIcon name={m.icon} size={18} /></span>
                  <span className="flex-1 truncate">{nameOf(m, locale)}</span>
                  <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/categories" className="mt-1 flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft">
            {t("cat.view_all")} <ChevronRight size={16} aria-hidden />
          </Link>
        </nav>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { title: t("home.buy_title"), body: t("home.buy_body"), icon: ShoppingBag, tint: "from-brand-soft to-white text-brand", href: "/search?in_stock=1&sort=price_asc", cta: t("home.cta_buy"), variant: "primary" as const },
            { title: t("home.sell_title"), body: t("home.sell_body"), icon: Store, tint: "from-accent-soft to-white text-accent-strong", href: "/sell/new", cta: t("home.cta_sell"), variant: "accent" as const },
            { title: t("home.seeker_title"), body: t("home.jobs_tile_body"), icon: UserSearch, tint: "from-success-soft to-white text-success", href: "/jobs", cta: t("home.seeker_cta"), variant: "primary" as const },
          ].map(({ title, body, icon: Icon, tint, href, cta, variant }) => (
            <div key={href} className="flex flex-col rounded-2xl border border-border bg-white p-4">
              <h2 className="text-lg font-extrabold text-brand-dark">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              <div className={`my-4 grid min-h-32 flex-1 place-items-center rounded-xl bg-gradient-to-br ${tint}`}>
                <Icon size={72} strokeWidth={1.4} aria-hidden />
              </div>
              <Link href={href} className={buttonClass(variant, "md", "mt-auto w-full rounded-full")}>{cta}</Link>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {signedIn ? (
            <section aria-labelledby="hello" className="rounded-2xl border border-border bg-white p-4">
              <h2 id="hello" className="text-lg font-extrabold text-brand-dark">{t("home.hello_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("home.hello_body")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { href: "/orders", icon: Package, label: t("orders.title") },
                  { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
                  { href: "/my/listings", icon: Store, label: t("nav.my_store") },
                  { href: "/favorites", icon: Heart, label: t("nav.saved") },
                ].map(({ href, icon: Icon, label }) => (
                  <li key={href}>
                    <Link href={href} className="flex h-full flex-col items-center gap-1 rounded-xl bg-muted p-3 text-center text-xs font-semibold text-brand-dark hover:bg-brand-soft">
                      <Icon size={22} className="text-brand" aria-hidden /> {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section aria-labelledby="join" className="rounded-2xl border border-border bg-white p-5">
              <h2 id="join" className="text-lg font-extrabold leading-snug text-brand-dark">{t("home.signin_title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("home.signin_body")}</p>
              <SignInButton className={buttonClass("accent", "md", "mt-4 w-full rounded-full")}>{t("home.signin_cta")}</SignInButton>
              <SignInButton mode="signup" className="mt-3 block text-center text-sm font-semibold text-brand underline">{t("home.signup_link")}</SignInButton>
            </section>
          )}
          <section aria-labelledby="promo" className="relative flex flex-1 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-brand-dark via-brand to-brand-sky p-5 text-white">
            <p className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold uppercase text-brand-dark">{t("home.promo_kicker")}</p>
            <h2 id="promo" className="mt-3 text-xl font-extrabold leading-tight">{t("home.promo_title")}</h2>
            <p className="mt-2 text-sm text-white/85">{t("home.promo_body")}</p>
            <Link href="/sell/new" className="mt-4 inline-flex h-11 w-fit items-center gap-1 rounded-full bg-white px-5 font-bold text-brand-dark hover:bg-accent-soft">
              {t("nav.post_free")} <ChevronRight size={16} aria-hidden />
            </Link>
            <span className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-accent/40 blur-2xl" aria-hidden />
          </section>
        </div>
      </div>

      {/* ── 4. Amazon-style cards: one per discovery tab, four categories each ── */}
      <section aria-labelledby="explore">
        <h2 id="explore" className="mb-3 text-xl font-bold text-brand-dark">{t("home.categories")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_TABS.map((tab) => {
            const inTab = majors.filter((m) => m.tab === tab);
            if (!inTab.length) return null;
            return (
              <div key={tab} className="flex flex-col rounded-2xl border border-border bg-white p-4">
                <Link href={`/categories?tab=${tab}`} className="group mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-lg font-extrabold leading-tight text-brand-dark group-hover:text-brand">{t(`cat.tab.${tab}`)}</h3>
                  <ChevronRight size={22} className="shrink-0 text-brand-dark group-hover:text-brand" aria-hidden />
                </Link>
                <ul className="grid grid-cols-2 gap-3">
                  {inTab.slice(0, 4).map((m, i) => (
                    <li key={m.id}>
                      <Link href={`/search?category=${m.slug}`} className="group block">
                        <span className={`grid aspect-square place-items-center rounded-xl transition-transform group-hover:scale-[1.03] ${TINTS[i % TINTS.length]}`}>
                          <CategoryIcon name={m.icon} size={40} />
                        </span>
                        <span className="mt-1.5 line-clamp-2 block text-xs font-medium text-foreground group-hover:text-brand sm:text-sm">{nameOf(m, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={`/categories?tab=${tab}`} className="mt-auto pt-3 text-sm font-semibold text-brand hover:underline">
                  {t("home.see_more", { n: inTab.length })}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Buyers are looking for: the newest open requests, so sellers find customers ── */}
      <section aria-labelledby="looking-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="looking-h" className="text-xl font-bold text-brand-dark">📣 {t("rq.home_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("rq.home_sub")}</p>
          </div>
          <span className="flex gap-2">
            <Link href="/looking-for/new" className={buttonClass("accent", "sm", "rounded-full")}>{t("rq.post_need")}</Link>
            <Link href="/looking-for" className={buttonClass("outline", "sm", "rounded-full")}>{t("home.see_all")}</Link>
          </span>
        </div>
        {requests.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {requests.map((r) => <li key={r.id}><RequestCard r={r} offers={r.offers} t={t} locale={locale} compact /></li>)}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("rq.home_empty")}</p>
        )}
      </section>

      {/* ── Featured members: sellers, employers, applicants, buyers ── */}
      <FeaturedMembers
        t={t}
        rows={[
          { kind: "seller", users: featuredUsers[0], more: "/search" },
          { kind: "employer", users: featuredUsers[1], more: "/jobs" },
          { kind: "applicant", users: featuredUsers[2], more: "/jobs/post" },
          { kind: "buyer", users: featuredUsers[3], more: "/search" },
        ]}
      />

      {/* ── 5. Latest listings (uniform square photos) ── */}
      <section aria-labelledby="latest">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="latest" className="text-xl font-bold text-brand-dark">{t("home.latest")}</h2>
          <Link href="/search" className="flex items-center gap-0.5 text-sm font-semibold text-brand hover:underline">
            {t("home.see_all")} <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
        <ListingGrid items={latest} t={t} />
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

      {/* ── 6. Jobs band ── */}
      <section aria-labelledby="jobs-band" className="grid gap-4 rounded-3xl border-2 border-accent bg-accent-soft p-5 md:grid-cols-[1.1fr_1fr_1fr] md:p-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent-strong">
            <BriefcaseBusiness size={16} aria-hidden /> {t("home.jobs_kicker")}
          </p>
          <h2 id="jobs-band" className="mt-1 text-2xl font-extrabold leading-tight text-brand-dark">{t("home.jobs_title")}</h2>
          <p className="mt-2 text-sm text-foreground">{t("home.jobs_sub")}</p>
        </div>
        {[
          { icon: UserSearch, title: t("home.seeker_title"), items: [t("home.seeker_1"), t("home.seeker_2"), t("home.seeker_3")], href: "/jobs", cta: t("home.seeker_cta"), href2: "/jobs/profile", cta2: t("home.seeker_cta2"), variant: "primary" as const },
          { icon: Building2, title: t("home.employer_title"), items: [t("home.employer_1"), t("home.employer_2"), t("home.employer_3")], href: "/jobs/post", cta: t("home.employer_cta"), href2: "/jobs/employer", cta2: t("home.employer_cta2"), variant: "accent" as const },
        ].map(({ icon: Icon, title, items, href, cta, href2, cta2, variant }) => (
          <div key={href} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-brand-dark"><Icon size={18} aria-hidden /> {title}</h3>
            <ul className="mb-4 mt-2 space-y-1 text-sm text-muted-foreground">
              {items.map((x) => <li key={x}>✓ {x}</li>)}
            </ul>
            <Link href={href} className={buttonClass(variant, "md", "mt-auto w-full rounded-full")}>{cta}</Link>
            <Link href={href2} className="mt-2 text-center text-sm font-semibold text-brand underline">{cta2}</Link>
          </div>
        ))}
      </section>

      {/* ── 7. Why us ── */}
      <section className="grid gap-3 md:grid-cols-3" aria-label={t("home.why")}>
        {[
          { icon: Store, title: t("home.why1_title"), body: t("home.why1_body") },
          { icon: BadgeCheck, title: t("home.why2_title"), body: t("home.why2_body") },
          { icon: Truck, title: t("home.why3_title"), body: t("home.why3_body") },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-border bg-white p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong"><Icon size={22} aria-hidden /></span>
            <div>
              <h3 className="font-bold text-brand-dark">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
