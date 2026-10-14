"use client";

import { Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { HANDOFF_KEY } from "@/components/sell/costing-calculator";
import { breakEven } from "@/lib/calculators";
import { formatPeso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

const KEY = "mph-break-even-v1";

type Draft = { fixed: { label: string; amount: string }[]; price: string; variableCost: string; workDays: string; targetProfit: string };
const n = (v: string) => Number(v) || 0;

/** Break-even: how many units (and how much in sales) per month cover your fixed costs, and what it takes to reach a profit goal. */
export function BreakEvenCalculator() {
  const { t } = useT();
  const empty: Draft = {
    fixed: [
      { label: t("be.rent"), amount: "" },
      { label: t("be.salaries"), amount: "" },
      { label: t("be.utilities"), amount: "" },
    ],
    price: "",
    variableCost: "",
    workDays: "26",
    targetProfit: "",
  };
  const [d, setD] = useState<Draft>(empty);
  const [loaded, setLoaded] = useState(false);

  // Restore this device's last draft, then apply a hand-off from the Costing Calculator if there is one.
  useEffect(() => {
    let next: Draft | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) next = { ...empty, ...JSON.parse(raw) };
      const hand = localStorage.getItem(HANDOFF_KEY);
      if (hand) {
        const h = JSON.parse(hand) as { price: number; variableCost: number };
        next = { ...(next ?? empty), price: String(h.price), variableCost: String(h.variableCost) };
        localStorage.removeItem(HANDOFF_KEY);
      }
    } catch {
      /* storage blocked or bad JSON */
    }
    if (next) setD(next); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore from device storage after hydration
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d, loaded]);

  const r = breakEven({
    fixedCosts: d.fixed.map((f) => ({ label: f.label, amount: n(f.amount) })),
    price: n(d.price),
    variableCost: n(d.variableCost),
    workDays: n(d.workDays),
    targetProfit: n(d.targetProfit),
  });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setLine = (i: number, patch: Partial<Draft["fixed"][number]>) => set({ fixed: d.fixed.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const hasPrice = n(d.price) > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4 rounded-2xl border border-border bg-white p-4 print:border-0">
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-brand-dark">{t("be.fixed")}</legend>
          <p className="text-xs text-muted-foreground">{t("be.fixed_hint")}</p>
          {d.fixed.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={t("calc.item")} value={m.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder={t("be.cost_ph")} className="flex-1" maxLength={60} />
              <Input aria-label={t("calc.cost")} type="number" inputMode="decimal" min={0} value={m.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="₱" className="w-32" />
              <button type="button" aria-label={t("upload.remove")} disabled={d.fixed.length === 1} onClick={() => set({ fixed: d.fixed.filter((_, j) => j !== i) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-soft disabled:opacity-30 print:hidden">
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          ))}
          {d.fixed.length < 20 && (
            <button type="button" onClick={() => set({ fixed: [...d.fixed, { label: "", amount: "" }] })} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand print:hidden">
              <Plus size={16} aria-hidden /> {t("be.add_cost")}
            </button>
          )}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("be.price")} hint={t("be.price_hint")}><Input type="number" inputMode="decimal" min={0} value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="₱" /></Field>
          <Field label={t("be.variable")} hint={t("be.variable_hint")}><Input type="number" inputMode="decimal" min={0} value={d.variableCost} onChange={(e) => set({ variableCost: e.target.value })} placeholder="₱" /></Field>
          <Field label={t("be.days")} hint={t("be.days_hint")}><Input type="number" inputMode="numeric" min={1} max={31} value={d.workDays} onChange={(e) => set({ workDays: e.target.value })} /></Field>
          <Field label={t("be.target")} hint={t("store.optional")}><Input type="number" inputMode="decimal" min={0} value={d.targetProfit} onChange={(e) => set({ targetProfit: e.target.value })} placeholder="₱" /></Field>
        </div>
      </div>

      <aside aria-live="polite" className="h-fit space-y-3 rounded-2xl bg-brand-dark p-5 text-white lg:sticky lg:top-32">
        <h2 className="font-bold">{t("calc.result")}</h2>
        {r ? (
          <>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/75">{t("be.units")}</p>
              <p className="text-3xl font-extrabold text-accent">{r.units.toLocaleString("en-PH")}</p>
              <p className="text-xs text-white/80">{t("be.per_day", { n: r.unitsPerDay.toLocaleString("en-PH") })}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-white/75">{t("be.fixed_total")}</dt><dd className="font-semibold">{formatPeso(r.fixedTotal)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-white/75">{t("be.contribution")}</dt><dd className="font-semibold">{formatPeso(r.contribution)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-white/75">{t("be.revenue")}</dt><dd className="font-semibold">{formatPeso(r.revenue)}</dd></div>
              {n(d.targetProfit) > 0 && (
                <div className="flex justify-between gap-2 border-t border-white/20 pt-2"><dt className="text-white/75">{t("be.target_units")}</dt><dd className="text-right font-semibold">{r.targetUnits.toLocaleString("en-PH")} · {formatPeso(r.targetRevenue)}</dd></div>
              )}
            </dl>
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/30 px-3 text-sm font-semibold hover:bg-white/10 print:hidden">
              <Printer size={16} aria-hidden /> {t("calc.print")}
            </button>
          </>
        ) : (
          <p className="text-sm text-white/80">{hasPrice ? t("be.losing") : t("be.need_price")}</p>
        )}
        <button type="button" onClick={() => setD(empty)} className="text-xs text-white/70 underline print:hidden">{t("calc.reset")}</button>
      </aside>
    </div>
  );
}
