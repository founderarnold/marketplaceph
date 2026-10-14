import { Megaphone, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { REQUEST_CARD_SELECT, RequestCard, type RequestCardData } from "@/components/requests/request-card";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CategoryOptions } from "@/components/listing/category-options";
import { categoryIdsFor } from "@/lib/categories";
import { getCategories, getLocations } from "@/lib/data";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Looking for: buyer requests",
  description: "Buyers post what they need; sellers and service providers send offers. Find customers looking for what you sell.",
};

const TABS = ["all", "for_me", "mine", "offers"] as const;
type Tab = (typeof TABS)[number];
const PAGE = 30;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function LookingForPage(props: PageProps<"/looking-for">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Board searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/looking-for">, "searchParams">) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(one(sp.tab) as Tab) ? (one(sp.tab) as Tab) : "all";
  const q = one(sp.q).replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
  const kind = ["product", "service"].includes(one(sp.kind)) ? one(sp.kind) : "";
  const cat = one(sp.category);
  const region = one(sp.region);
  const page = Math.min(50, Math.max(1, Math.floor(Number(one(sp.page))) || 1));
  const { t, locale } = await getT();
  const supabase = await createClient();
  const [{ data: claims }, categories, locations] = await Promise.all([supabase.auth.getClaims(), getCategories(), getLocations()]);
  const me = (claims?.claims?.sub as string | undefined) ?? null;

  let rows: RequestCardData[] = [];
  let note: string | null = null;
  const nowIso = new Date().toISOString();
  if (tab === "all" || tab === "for_me") {
    let query = supabase.from("buy_requests").select(REQUEST_CARD_SELECT).eq("status", "open").gt("expires_at", nowIso);
    if (q) query = query.ilike("title", `%${q}%`);
    if (kind) query = query.eq("kind", kind);
    if (region) query = query.eq("region_code", region);
    if (cat) {
      const ids = categoryIdsFor(categories, cat);
      query = ids ? query.in("category_id", ids) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    if (tab === "for_me") {
      // requests in the categories (and their main categories) of what my store sells
      const { data: store } = me ? await supabase.from("stores").select("id").eq("owner_id", me).limit(1).maybeSingle() : { data: null };
      const { data: mine } = store ? await supabase.from("listings").select("category_id").eq("store_id", store.id).eq("status", "active") : { data: [] as { category_id: string | null }[] };
      const set = new Set<string>();
      for (const l of mine ?? []) {
        if (!l.category_id) continue;
        set.add(l.category_id);
        const c = categories.find((x) => x.id === l.category_id);
        if (c?.parent_id) set.add(c.parent_id);
        for (const child of categories.filter((x) => x.parent_id === l.category_id)) set.add(child.id);
      }
      if (!store) note = t("rq.for_me_no_store");
      else if (!set.size) note = t("rq.for_me_no_listings");
      query = set.size ? query.in("category_id", [...set]) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      if (me) query = query.neq("buyer_id", me);
    }
    const { data } = await query.order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1).overrideTypes<RequestCardData[], { merge: false }>();
    rows = data ?? [];
  } else if (tab === "mine" && me) {
    const { data } = await supabase.from("buy_requests").select(REQUEST_CARD_SELECT).eq("buyer_id", me).order("created_at", { ascending: false }).limit(100).overrideTypes<RequestCardData[], { merge: false }>();
    rows = data ?? [];
  }
  const { data: counts } = rows.length ? await supabase.rpc("request_offer_counts", { p_ids: rows.map((r) => r.id) }) : { data: [] };
  const offerCount = new Map((counts ?? []).map((c) => [c.request_id, c.offers]));

  const href = (patch: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    const base: Record<string, string | number | null> = { tab: tab === "all" ? null : tab, q: q || null, kind: kind || null, category: cat || null, region: region || null, page: null, ...patch };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== "") u.set(k, String(v));
    const s = u.toString();
    return s ? `/looking-for?${s}` : "/looking-for";
  };

  return (
    <div className="space-y-5">
      <section className="-mx-4 -mt-4 bg-gradient-to-br from-accent-soft via-white to-brand-soft px-4 py-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-brand-dark md:text-4xl">
            <Megaphone size={30} className="text-accent-strong" aria-hidden /> {t("rq.board_title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("rq.board_sub")}</p>
          <Link href="/looking-for/new" className={buttonClass("accent", "lg", "mt-4 gap-2 rounded-full")}>
            <Plus size={18} aria-hidden /> {t("rq.post_need")}
          </Link>
        </div>
      </section>

      <nav aria-label={t("rq.board_title")} className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold">
        {TABS.map((x) => (
          <Link key={x} href={x === "all" ? "/looking-for" : `/looking-for?tab=${x}`} aria-current={tab === x ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2", tab === x ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}>
            {t(`rq.tab.${x}`)}
          </Link>
        ))}
      </nav>

      {(tab === "all" || tab === "for_me") && (
        <form action="/looking-for" className="grid gap-2 rounded-2xl border border-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <label className="relative">
            <span className="sr-only">{t("rq.search")}</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input name="q" defaultValue={q} placeholder={t("rq.search")} className="pl-9" />
          </label>
          <Select name="kind" defaultValue={kind} aria-label={t("rq.kind")} className="lg:w-36">
            <option value="">{t("rq.kind.any")}</option>
            <option value="product">{t("rq.kind.product")}</option>
            <option value="service">{t("rq.kind.service")}</option>
          </Select>
          <Select name="category" defaultValue={cat} aria-label={t("filters.category")} className="lg:w-52">
            <option value="">{t("filters.all")}</option>
            <CategoryOptions categories={categories} locale={locale} valueOf="slug" majorLabel={(n) => t("cat.all_of", { name: n })} />
          </Select>
          <Select name="region" defaultValue={region} aria-label={t("rq.region")} className="lg:w-44">
            <option value="">{t("rq.all_regions")}</option>
            {locations.regions.map((r) => <option key={r.code} value={r.code}>{r.short_name ?? r.name}</option>)}
          </Select>
          <button className={buttonClass("primary", "md")}>{t("filters.apply")}</button>
        </form>
      )}

      {tab === "offers" ? (
        <MyOffers me={me} />
      ) : !me && (tab === "mine" || tab === "for_me") ? (
        <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t("rq.sign_in")}</p>
      ) : (
        <>
          {note && <p className="rounded-2xl bg-accent-soft p-4 text-sm text-accent-strong">{note} <Link href="/sell/new" className="font-semibold underline">{t("nav.post_free")}</Link></p>}
          {rows.length === 0 ? (
            <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
              <p className="text-muted-foreground">{tab === "mine" ? t("rq.mine_empty") : t("rq.empty")}</p>
              <Link href="/looking-for/new" className={buttonClass("accent", "md")}>{t("rq.post_need")}</Link>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <li key={r.id}><RequestCard r={r} offers={offerCount.get(r.id) ?? 0} t={t} locale={locale} /></li>
              ))}
            </ul>
          )}
          {(tab === "all" || tab === "for_me") && (page > 1 || rows.length === PAGE) && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
              {page > 1 && <Link href={href({ page: page - 1 })} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted">← {t("common.prev")}</Link>}
              <span className="text-sm text-muted-foreground">{page}</span>
              {rows.length === PAGE && <Link href={href({ page: page + 1 })} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-muted">{t("common.next")} →</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

async function MyOffers({ me }: { me: string | null }) {
  const { t } = await getT();
  if (!me) return <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t("rq.sign_in")}</p>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("buy_request_offers")
    .select("id, status, unit_price, quantity, created_at, conversation_id, buy_requests ( id, title, status )")
    .eq("seller_id", me)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!data?.length) return <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t("rq.offers_empty")}</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
      {data.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <span className="min-w-0">
            <Link href={`/looking-for/${o.buy_requests?.id}`} className="block truncate font-semibold text-brand-dark hover:underline">{o.buy_requests?.title}</Link>
            <span className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", o.status === "accepted" ? "bg-success-soft text-success" : o.status === "sent" ? "bg-brand-soft text-brand-dark" : "bg-muted text-muted-foreground")}>{t(`rq.offer_status.${o.status}`)}</span>
            {o.conversation_id && <Link href={`/messages/${o.conversation_id}`} className="text-sm font-semibold text-brand underline">{t("nav.messages")}</Link>}
          </span>
        </li>
      ))}
    </ul>
  );
}
