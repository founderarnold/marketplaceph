import type { Metadata } from "next";
import { Suspense } from "react";
import { ProNote } from "@/components/business/pro-note";
import { BarList, ExportButtons, RangePicker, StatGrid } from "@/components/business/ui";
import { businessContext, daysAgoIso, isoDay, peso } from "@/lib/business";
import { parseRange } from "@/lib/export";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage(props: PageProps<"/business/reports">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Reports searchParams={props.searchParams} />
    </Suspense>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Reports({ searchParams }: Pick<PageProps<"/business/reports">, "searchParams">) {
  const sp = await searchParams;
  const { supabase, rank, can, store, t } = await businessContext();
  const pro = can("reports_full");
  const now = new Date();
  const { from, to } = parseRange(first(sp.from), first(sp.to), now);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const longRange = days > 31;
  const locked = longRange && !can("long_ranges"); // free users: summaries only, up to 31 days

  const month = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const presets = [
    { label: t("rep.this_month"), from: month, to: isoDay(now) },
    { label: t("rep.last_30"), from: daysAgoIso(30, now), to: isoDay(now) },
    { label: t("rep.last_90"), from: daysAgoIso(90, now), to: isoDay(now), pro: true },
    { label: t("rep.this_year"), from: `${now.getUTCFullYear()}-01-01`, to: isoDay(now), pro: true },
  ];

  const bucket = days > 120 ? "month" : days > 31 ? "week" : "day";
  const [sSum, sSeries, best, top, bSum, bySup, byCat, bSeries] = await Promise.all([
    store && !locked ? supabase.rpc("seller_sales_summary", { p_store: store.id, p_from: from, p_to: to }) : Promise.resolve({ data: null }),
    store && pro ? supabase.rpc("seller_sales_series", { p_store: store.id, p_from: from, p_to: to, p_bucket: bucket }) : Promise.resolve({ data: null }),
    store && pro ? supabase.rpc("seller_best_sellers", { p_store: store.id, p_from: from, p_to: to, p_limit: 8 }) : Promise.resolve({ data: null }),
    store && pro ? supabase.rpc("seller_top_customers", { p_store: store.id, p_from: from, p_to: to, p_limit: 8 }) : Promise.resolve({ data: null }),
    !locked ? supabase.rpc("buyer_spend_summary", { p_from: from, p_to: to }) : Promise.resolve({ data: null }),
    pro ? supabase.rpc("buyer_spend_by_supplier", { p_from: from, p_to: to }) : Promise.resolve({ data: null }),
    pro ? supabase.rpc("buyer_spend_by_category", { p_from: from, p_to: to }) : Promise.resolve({ data: null }),
    pro ? supabase.rpc("buyer_spend_series", { p_from: from, p_to: to, p_bucket: days > 120 ? "month" : "week" }) : Promise.resolve({ data: null }),
  ]);
  const s = sSum.data?.[0];
  const b = bSum.data?.[0];
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.reports")}</h1>
        <p className="text-sm text-muted-foreground">{t("rep.intro")}</p>
      </div>
      <RangePicker base="/business/reports" from={from} to={to} presets={presets} t={t} />
      {locked && <ProNote t={t} need="long_ranges" feature={t("rep.long_locked")} />}

      {store && (
        <section className="space-y-3" aria-labelledby="sell-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="sell-h" className="text-lg font-bold text-brand-dark">{t("rep.selling")}</h2>
            <ExportButtons kind="sales" from={from} to={to} rank={rank} t={t} />
          </div>
          {s ? (
            <StatGrid items={[[t("biz.sales"), peso(s.revenue)], [t("biz.orders"), String(s.orders_count)], [t("rep.items"), Number(s.items_sold).toLocaleString("en-PH")], [t("biz.avg_order"), peso(s.avg_order)], [t("biz.new_customers"), String(s.new_customers)], [t("rep.repeat"), String(s.repeat_customers)]]} />
          ) : !locked && <p className="text-sm text-muted-foreground">{t("rep.none")}</p>}
          {pro ? (
            <>
              {(sSeries.data?.length ?? 0) > 0 && (
                <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
                  <h3 className="font-bold text-brand-dark">{t("rep.trend")} <span className="text-xs font-normal text-muted-foreground">({t(`rep.by.${bucket}`)})</span></h3>
                  <BarList rows={sSeries.data!.map((r) => ({ label: fmtDay(r.period), value: Number(r.revenue), sub: t("crm.orders_n", { n: r.orders_count }) }))} format={peso} />
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
                  <h3 className="font-bold text-brand-dark">{t("rep.best")}</h3>
                  {best.data?.length ? <BarList rows={best.data.map((r) => ({ label: r.title, value: Number(r.revenue), sub: `${Number(r.qty).toLocaleString("en-PH")} ${t("rep.units")}` }))} format={peso} /> : <p className="text-sm text-muted-foreground">{t("rep.best_empty")}</p>}
                </div>
                <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
                  <h3 className="font-bold text-brand-dark">{t("rep.top_customers")}</h3>
                  {top.data?.length ? <BarList rows={top.data.map((r) => ({ label: r.display_name, value: Number(r.spent), sub: t("crm.orders_n", { n: r.orders_count }) }))} format={peso} /> : <p className="text-sm text-muted-foreground">{t("rep.none")}</p>}
                </div>
              </div>
            </>
          ) : (
            <ProNote t={t} need="reports_full" feature={t("rep.pro_sections")} />
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="buy-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="buy-h" className="text-lg font-bold text-brand-dark">{t("rep.buying")}</h2>
          <ExportButtons kind="purchases" from={from} to={to} rank={rank} t={t} />
        </div>
        {b ? <StatGrid items={[[t("rep.spent"), peso(b.total_spent)], [t("biz.orders"), String(b.orders_count)], [t("rep.suppliers"), String(b.suppliers_count)]]} /> : !locked && <p className="text-sm text-muted-foreground">{t("rep.none")}</p>}
        {pro ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <h3 className="font-bold text-brand-dark">{t("rep.by_supplier")}</h3>
              {bySup.data?.length ? <BarList rows={bySup.data.map((r) => ({ label: r.store_name, value: Number(r.spent), sub: t("crm.orders_n", { n: r.orders_count }) }))} format={peso} /> : <p className="text-sm text-muted-foreground">{t("rep.none")}</p>}
            </div>
            <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <h3 className="font-bold text-brand-dark">{t("rep.by_category")}</h3>
              {byCat.data?.length ? <BarList rows={byCat.data.map((r) => ({ label: r.category, value: Number(r.spent) }))} format={peso} /> : <p className="text-sm text-muted-foreground">{t("rep.none")}</p>}
            </div>
            {(bSeries.data?.length ?? 0) > 0 && (
              <div className="space-y-2 rounded-2xl border border-border bg-white p-4 md:col-span-2">
                <h3 className="font-bold text-brand-dark">{t("rep.spend_trend")}</h3>
                <BarList rows={bSeries.data!.map((r) => ({ label: fmtDay(r.period), value: Number(r.spent), sub: t("crm.orders_n", { n: r.orders_count }) }))} format={peso} />
              </div>
            )}
          </div>
        ) : (
          <ProNote t={t} need="reports_full" feature={t("rep.pro_buyer")} />
        )}
      </section>
      <p className="text-xs text-muted-foreground">{t("rep.basis")}</p>
    </div>
  );
}
