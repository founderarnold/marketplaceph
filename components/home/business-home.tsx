import {
  AlertTriangle, BadgeCheck, BriefcaseBusiness, Bike, Boxes, CircleDollarSign, Heart, Megaphone, MessageCircle, Package, Plus, ShieldCheck,
  ShoppingBag, Store, Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FlameAdSlot } from "@/components/ads/flame-ad-slot";
import { SetupChecklist } from "@/components/business/setup-checklist";
import { JOB_CARD_SELECT, JobCard, type JobCardData } from "@/components/jobs/job-card";
import { RoleOnboarding } from "@/components/home/role-onboarding";
import { ListingGrid } from "@/components/listing/listing-card";
import { RequestCard } from "@/components/requests/request-card";
import { UpdateComposer } from "@/components/social/update-composer";
import { getFeaturedStores, getLatestListings, getOpenRequests } from "@/lib/data";
import { priceLabel, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { imageUrl, thumbUrl } from "@/lib/images";
import { salaryLabel } from "@/lib/jobs";
import { tierByRank } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Signed-in home ("Business Home"): shortcuts on the left, a post box + feed in the middle, today's work on the right.
 * Everything here reads data that already exists (stores, orders, friends_feed, listings, requests, jobs); signed-out
 * visitors never reach it (see app/page.tsx).
 */
const FEEDS = ["network", "products", "requests", "jobs"] as const;
export type BusinessFeed = (typeof FEEDS)[number];
export const parseFeed = (v: unknown): BusinessFeed => (FEEDS.includes(v as BusinessFeed) ? (v as BusinessFeed) : "network");

const card = "rounded-2xl border border-border bg-white";

export async function BusinessHome({ userId, feed }: { userId: string; feed: BusinessFeed }) {
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: store }, { data: mine }] = await Promise.all([
    supabase.from("stores").select("id, name, slug, logo_url, verification_level").eq("owner_id", userId).limit(1).maybeSingle(),
    supabase.rpc("my_tier"),
  ]);
  const tier = tierByRank(mine?.[0]?.rank ?? 0);

  const shortcuts = [
    { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { href: "/orders", icon: Package, label: t("orders.title") },
    { href: "/my/listings", icon: Store, label: t("my.title") },
    { href: "/looking-for", icon: Megaphone, label: t("nav.looking_for") },
    { href: "/business/customers", icon: Users, label: t("biz.nav.customers") },
    { href: "/business/inventory", icon: Boxes, label: t("biz.nav.inventory") },
    { href: "/business/finance", icon: CircleDollarSign, label: t("biz.nav.finance") },
    { href: "/jobs", icon: BriefcaseBusiness, label: t("nav.jobs") },
    { href: "/delivery", icon: Bike, label: t("nav.delivery") },
    { href: "/favorites", icon: Heart, label: t("nav.saved") },
    { href: "/check", icon: ShieldCheck, label: t("nav.check") },
    { href: "/business/plan", icon: BadgeCheck, label: t("biz.nav.plan") },
  ];

  const storeCard = store ? (
    <Link href={`/store/${store.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-brand-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={store.logo_url ? imageUrl(store.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border border-border bg-white object-cover" />
      <span className="min-w-0">
        <span className="flex items-center gap-1 truncate font-bold text-brand-dark">
          {store.name}
          {(store.verification_level ?? 0) > 0 && <BadgeCheck size={16} className="shrink-0 text-brand" aria-label={t("footer.verify")} />}
        </span>
        <span className="block text-xs font-semibold text-accent-strong">{tier.name}</span>
      </span>
    </Link>
  ) : (
    <Link href="/sell/new" className="block rounded-xl bg-accent-soft p-3 hover:brightness-95">
      <span className="block font-bold text-brand-dark">{t("bh.start_store")}</span>
      <span className="block text-xs text-muted-foreground">{t("bh.start_store_body")}</span>
    </Link>
  );

  const today = (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
      <TodayPanel userId={userId} storeId={store?.id ?? null} />
    </Suspense>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      {/* Left rail: who I am + shortcuts (desktop). Phones get a scrolling strip below the post box. */}
      <aside aria-label={t("bh.shortcuts")} className="hidden lg:block">
        <nav className={cn(card, "sticky top-36 max-h-[calc(100dvh-10rem)] space-y-1 overflow-y-auto p-2")}>
          {storeCard}
          <ul className="border-t border-border pt-1">
            {shortcuts.map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-brand-dark hover:bg-brand-soft hover:text-brand">
                  <Icon size={20} className="shrink-0 text-brand" aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Center: post box, quick actions, feed */}
      <main className="min-w-0 space-y-4" aria-label={t("bh.feed_label")}>
        <h1 className="sr-only">{t("bh.hello")}</h1>
        {!store && <RoleOnboarding />}
        <section className={cn(card, "p-4")} aria-label={t("bh.prompt")}>
          <p className="mb-3 font-bold text-brand-dark">{t("bh.prompt")}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/sell/new", icon: Plus, label: t("bh.post_product"), cls: "bg-accent text-brand-dark hover:bg-[#ea6a0c]" },
              { href: "/looking-for/new", icon: Megaphone, label: t("bh.post_need"), cls: "bg-brand-soft text-brand hover:bg-brand hover:text-white" },
              { href: "/jobs/post", icon: BriefcaseBusiness, label: t("bh.post_job"), cls: "bg-brand-soft text-brand hover:bg-brand hover:text-white" },
              { href: "/updates", icon: Users, label: t("bh.post_update"), cls: "bg-brand-soft text-brand hover:bg-brand hover:text-white" },
            ].map(({ href, icon: Icon, label, cls }) => (
              <li key={href}>
                <Link href={href} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-center text-sm font-bold", cls)}>
                  <Icon size={18} aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t("bh.quick")}>
          <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {[
              { href: "/business/inventory", icon: Boxes, label: t("bh.qa_stock") },
              { href: "/business/finance", icon: CircleDollarSign, label: t("bh.qa_money") },
              { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
              { href: "/delivery/new", icon: Bike, label: t("bh.qa_rider") },
              { href: "/check", icon: ShieldCheck, label: t("nav.check") },
            ].map(({ href, icon: Icon, label }) => (
              <li key={href} className="shrink-0">
                <Link href={href} className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold text-brand-dark hover:border-brand hover:text-brand">
                  <Icon size={16} className="text-brand" aria-hidden /> {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Phones: the "today" summary and shortcut strip come before the feed */}
        <div className="space-y-4 lg:hidden">
          {today}
          <nav aria-label={t("bh.shortcuts")}>
            <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {shortcuts.map(({ href, icon: Icon, label }) => (
                <li key={href} className="shrink-0">
                  <Link href={href} className="flex min-h-11 items-center gap-2 rounded-xl bg-muted px-3 text-sm font-semibold text-brand-dark">
                    <Icon size={16} className="text-brand" aria-hidden /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <nav aria-label={t("bh.feed_label")} className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold [scrollbar-width:none]">
          {FEEDS.map((x) => (
            <Link
              key={x}
              href={x === "network" ? "/" : `/?feed=${x}`}
              aria-current={feed === x ? "page" : undefined}
              className={cn("flex min-h-10 items-center whitespace-nowrap rounded-lg px-3", feed === x ? "bg-white text-brand shadow-sm" : "text-muted-foreground hover:text-brand")}
            >
              {t(`bh.chip_${x}`)}
            </Link>
          ))}
        </nav>

        <Suspense key={feed} fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <FeedSection feed={feed} userId={userId} storeId={store?.id ?? null} />
        </Suspense>
      </main>

      {/* Right rail: today's work, setup, suggestions, sponsor (desktop) */}
      <aside aria-label={t("bh.today")} className="hidden space-y-4 lg:block">
        <div className="sticky top-36 space-y-4">
          {today}
          <Suspense fallback={null}>
            <Suggested />
          </Suspense>
          <FlameAdSlot slot="DASHBOARD_SPONSOR" />
        </div>
      </aside>
    </div>
  );
}

async function TodayPanel({ userId, storeId }: { userId: string; storeId: string | null }) {
  const { t } = await getT();
  const supabase = await createClient();
  const [sellerTodo, buyerTodo, listings, reminders] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).in("status", ["requested", "payment_submitted", "paid", "packed"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", userId).in("status", ["quoted", "shipped", "delivered"]),
    storeId ? supabase.from("listings").select("quantity_on_hand, low_stock_threshold").eq("store_id", storeId).neq("status", "removed") : Promise.resolve({ data: null }),
    supabase.from("restock_reminders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("enabled", true),
  ]);
  const orders = (sellerTodo.count ?? 0) + (buyerTodo.count ?? 0);
  const low = (listings.data ?? []).filter((l) => l.quantity_on_hand !== null && l.quantity_on_hand <= (l.low_stock_threshold ?? 5)).length;
  const rem = reminders.count ?? 0;
  const rows = [
    orders > 0 && { href: "/orders", icon: Package, text: t("bh.today_orders", { n: orders }) },
    low > 0 && { href: "/business/inventory", icon: AlertTriangle, text: t("bh.today_low", { n: low }) },
    rem > 0 && { href: "/business/reminders", icon: ShoppingBag, text: t("bh.today_reminders", { n: rem }) },
  ].filter(Boolean) as { href: string; icon: typeof Package; text: string }[];
  return (
    <div className="space-y-4">
      <section className={cn(card, "p-4")} aria-labelledby="bh-today">
        <h2 id="bh-today" className="font-extrabold text-brand-dark">{t("bh.today")}</h2>
        {rows.length ? (
          <ul className="mt-2 space-y-1">
            {rows.map(({ href, icon: Icon, text }) => (
              <li key={href}>
                <Link href={href} className="flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-3 text-sm font-semibold text-accent-strong hover:brightness-95">
                  <Icon size={18} aria-hidden /> {text}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("bh.today_clear")}</p>
        )}
      </section>
      <SetupChecklist supabase={supabase} storeId={storeId} t={t} />
    </div>
  );
}

async function Suggested() {
  const { t } = await getT();
  const stores = await getFeaturedStores(4);
  if (!stores.length) return null;
  return (
    <section className={cn(card, "p-4")} aria-labelledby="bh-sug">
      <h2 id="bh-sug" className="font-extrabold text-brand-dark">{t("bh.suggested")}</h2>
      <ul className="mt-2 space-y-1">
        {stores.map((s) => (
          <li key={s.id}>
            <Link href={`/store/${s.slug}`} className="flex min-h-11 items-center gap-3 rounded-xl p-1 hover:bg-brand-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo_url ? imageUrl(s.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full border border-border bg-white object-cover" />
              <span className="min-w-0 truncate text-sm font-semibold text-brand-dark">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function FeedSection({ feed, userId, storeId }: { feed: BusinessFeed; userId: string; storeId: string | null }) {
  const { t, locale } = await getT();
  const supabase = await createClient();

  if (feed === "products") {
    const latest = await getLatestListings(12);
    return <ListingGrid items={latest} t={t} />;
  }
  if (feed === "requests") {
    const requests = await getOpenRequests(12);
    if (!requests.length) return <Empty body={t("rq.home_empty")} href="/looking-for/new" cta={t("rq.post_need")} />;
    return <ul className="grid gap-3 sm:grid-cols-2">{requests.map((r) => <li key={r.id}><RequestCard r={r} offers={r.offers} t={t} locale={locale} compact /></li>)}</ul>;
  }
  if (feed === "jobs") {
    const { data } = await supabase.from("job_posts").select(JOB_CARD_SELECT).eq("status", "active").order("created_at", { ascending: false }).limit(10).overrideTypes<JobCardData[], { merge: false }>();
    if (!data?.length) return <Empty body={t("bh.jobs_empty")} href="/jobs/post" cta={t("bh.post_job")} />;
    return <ul className="space-y-3">{data.map((j) => <JobCard key={j.id} job={j} t={t} />)}</ul>;
  }

  // My network: updates, listings and jobs from people I added, plus the box to post my own update.
  const [{ data: myJobs }, { data: myListings }, { data: rows }] = await Promise.all([
    supabase.from("job_posts").select("id, title").eq("owner_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(20),
    storeId ? supabase.from("listings").select("id, title").eq("store_id", storeId).eq("status", "active").order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    supabase.rpc("friends_feed", { p_limit: 20 }),
  ]);
  const linkable = [
    ...(myListings ?? []).map((l) => ({ value: `listing:${l.id}`, label: `🛒 ${l.title}` })),
    ...(myJobs ?? []).map((j) => ({ value: `job:${j.id}`, label: `💼 ${j.title}` })),
  ];
  const items = rows ?? [];
  return (
    <div className="space-y-4">
      <UpdateComposer items={linkable} />
      {items.length === 0 ? (
        <>
          <Empty body={t("bh.network_empty")} href="/search" cta={t("nav.shop")} />
          <h2 className="font-extrabold text-brand-dark">{t("bh.discover")}</h2>
          <ListingGrid items={await getLatestListings(8)} t={t} />
        </>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.kind + it.item_id} className={cn(card, "p-3")}>
              <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                <b className="text-foreground">{it.actor_name}</b> {t(`updates.kind.${it.kind}`)} · {timeAgo(it.created_at)}
              </p>
              {it.kind === "update" && (
                <div className="mt-1 space-y-1">
                  <p className="whitespace-pre-line break-words text-sm">{it.body}</p>
                  {it.link_slug && it.title && (
                    <Link href={it.title === "job" ? `/jobs/${it.link_slug}` : `/listing/${it.link_slug}`} className="text-sm font-semibold text-brand hover:underline">
                      {t(it.title === "job" ? "updates.see_job" : "updates.see_item")} →
                    </Link>
                  )}
                </div>
              )}
              {it.kind === "listing" && (
                <Link href={`/listing/${it.item_id}`} className="mt-2 flex gap-3 rounded-xl p-1 hover:bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbUrl(it.image_path)} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{it.title}</span>
                    <span className="block text-sm font-bold text-brand-dark">{priceLabel({ price_type: it.price_type ?? "message", price_min: it.price_min, price_max: it.price_max, unit: it.unit ?? "pc" }, t)}</span>
                  </span>
                </Link>
              )}
              {it.kind === "job" && (
                <Link href={`/jobs/${it.item_id}`} className="mt-2 block rounded-xl p-1 hover:bg-muted">
                  <span className="block font-semibold">{it.title}</span>
                  <span className="block text-sm text-muted-foreground">{salaryLabel(it.price_min, it.price_max, null, (p) => p) ?? t("updates.see_job")}</span>
                </Link>
              )}
            </li>
          ))}
          <li>
            <Link href="/updates" className="block rounded-xl border border-border bg-white p-3 text-center text-sm font-semibold text-brand hover:bg-muted">{t("bh.more")}</Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function Empty({ body, href, cta }: { body: string; href: string; cta: string }) {
  return (
    <div className="space-y-3 rounded-2xl bg-muted p-6 text-center">
      <p className="text-sm text-muted-foreground">{body}</p>
      <Link href={href} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">{cta}</Link>
    </div>
  );
}
