import { Info } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EntryDelete, EntryForm } from "@/components/business/forms";
import { ProBadge, ProNote } from "@/components/business/pro-note";
import { ExportButtons, RangePicker, StatGrid } from "@/components/business/ui";
import { businessContext, daysAgoIso, isoDay, peso } from "@/lib/business";
import { parseRange } from "@/lib/export";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage(props: PageProps<"/business/finance">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Finance searchParams={props.searchParams} />
    </Suspense>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const INCOME_CATS = ["Walk-in sales", "Online sales (outside MarketplacePH)", "Services", "Other income"];
const EXPENSE_CATS = ["Raw materials", "Packaging", "Transport", "Rent", "Utilities", "Salaries", "Marketing", "Equipment", "Taxes & permits", "Other expense"];

async function Finance({ searchParams }: Pick<PageProps<"/business/finance">, "searchParams">) {
  const sp = await searchParams;
  const { supabase, rank, can, t } = await businessContext();
  const plOk = can("finance_pl");
  const now = new Date();
  const { from, to } = parseRange(first(sp.from), first(sp.to), now);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const locked = days > 31 && !can("long_ranges");

  const month = isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const presets = [
    { label: t("rep.this_month"), from: month, to: isoDay(now) },
    { label: t("rep.last_30"), from: daysAgoIso(30, now), to: isoDay(now) },
    { label: t("rep.last_90"), from: daysAgoIso(90, now), to: isoDay(now), pro: true },
    { label: t("rep.this_year"), from: `${now.getUTCFullYear()}-01-01`, to: isoDay(now), pro: true },
  ];

  const [sum, pl, inc, exp] = await Promise.all([
    locked ? Promise.resolve({ data: null }) : supabase.rpc("finance_summary", { p_from: from, p_to: to }),
    plOk ? supabase.rpc("finance_pl", { p_from: from, p_to: to }) : Promise.resolve({ data: null }),
    supabase.from("income_entries").select("id, entry_date, amount, category, note").gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }).limit(100),
    supabase.from("expenses").select("id, entry_date, amount, category, vendor, note").gte("entry_date", from).lte("entry_date", to).order("entry_date", { ascending: false }).limit(100),
  ]);
  const f = sum.data?.[0];
  const income = (pl.data ?? []).filter((r) => r.section === "income");
  const expense = (pl.data ?? []).filter((r) => r.section === "expense");
  const totalIn = income.reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = expense.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.finance")}</h1>
        <p className="flex gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark"><Info size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("fin.disclaimer")}</p>
      </div>
      <RangePicker base="/business/finance" from={from} to={to} presets={presets} t={t} />
      {locked && <ProNote t={t} need="long_ranges" feature={t("rep.long_locked")} />}

      {f && (
        <section aria-labelledby="sum-h" className="space-y-2">
          <h2 id="sum-h" className="text-lg font-bold text-brand-dark">{t("fin.summary")}</h2>
          <StatGrid items={[[t("fin.sales_orders"), peso(f.order_income)], [t("fin.manual_income"), peso(f.manual_income)], [t("fin.expenses"), peso(f.manual_expenses)], [t("fin.purchases"), peso(f.purchases)], [t("fin.net"), peso(f.net)]]} />
          <p className="text-xs text-muted-foreground">{t("fin.basis")}</p>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <EntryForm kind="income" categories={INCOME_CATS} />
        <EntryForm kind="expense" categories={EXPENSE_CATS} />
      </div>

      <section className="space-y-3" aria-labelledby="pl-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pl-h" className="flex items-center gap-2 text-lg font-bold text-brand-dark">{t("fin.pl")} <ProBadge t={t} need="finance_pl" /></h2>
          <ExportButtons kind="finance" from={from} to={to} rank={rank} t={t} />
        </div>
        {plOk ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              [t("fin.income"), income, totalIn],
              [t("fin.expenses"), expense, totalOut],
            ].map(([title, rows, total]) => (
              <div key={title as string} className="rounded-2xl border border-border bg-white p-4">
                <h3 className="font-bold text-brand-dark">{title as string}</h3>
                <table className="mt-2 w-full text-sm"><tbody>
                  {(rows as typeof income).map((r) => <tr key={r.category} className="border-b border-border last:border-0"><td className="py-1.5">{r.category}</td><td className="py-1.5 text-right">{peso(r.amount)}</td></tr>)}
                  <tr className="font-extrabold"><td className="pt-2">{t("order.total")}</td><td className="pt-2 text-right">{peso(total as number)}</td></tr>
                </tbody></table>
              </div>
            ))}
            <p className="rounded-2xl bg-success-soft p-4 text-lg font-extrabold text-brand-dark md:col-span-2">{t("fin.profit")}: {peso(totalIn - totalOut)}</p>
          </div>
        ) : (
          <ProNote t={t} need="finance_pl" feature={t("fin.pl_locked")} />
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-labelledby="ent-h">
        <h2 id="ent-h" className="sr-only">{t("fin.entries")}</h2>
        {([["income", inc.data ?? [], t("fin.income")], ["expense", exp.data ?? [], t("fin.expenses")]] as const).map(([kind, rows, title]) => (
          <div key={kind} className="space-y-2">
            <h3 className="font-bold text-brand-dark">{title} <span className="text-xs font-normal text-muted-foreground">({t("fin.entered_by_you")})</span></h3>
            {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("fin.none")}</p> : (
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><b>{r.category}</b> · {new Date(r.entry_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}{"vendor" in r && r.vendor ? ` · ${r.vendor}` : ""}{r.note ? <span className="block truncate text-muted-foreground">{r.note}</span> : null}</span>
                    <b>{peso(r.amount)}</b>
                    <EntryDelete kind={kind} id={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
