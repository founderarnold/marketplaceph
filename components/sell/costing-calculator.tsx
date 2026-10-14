"use client";

import { Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { costing, type CostLine } from "@/lib/calculators";
import { formatPeso } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export const COSTING_KEY = "mph-costing-v1";
export const HANDOFF_KEY = "mph-costing-handoff-v1";

type Draft = { product: string; materials: { label: string; amount: string }[]; labor: string; overhead: string; packaging: string; yieldUnits: string; markupPct: string };
const EMPTY: Draft = { product: "", materials: [{ label: "", amount: "" }], labor: "", overhead: "", packaging: "", yieldUnits: "", markupPct: "50" };
const n = (v: string) => Number(v) || 0;

/** Product costing: what one unit really costs (materials + labor + overhead + packaging) and a price with your markup. */
export function CostingCalculator() {
  const { t } = useT();
  const [d, setD] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  // Restore the last draft on this device (a convenience only; nothing is sent to the server).
  useEffect(() => {
    let saved: Draft | null = null;
    try {
      const raw = localStorage.getItem(COSTING_KEY);
      if (raw) saved = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      /* storage blocked or bad JSON: start empty */
    }
    if (saved) setD(saved); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore from device storage after hydration
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(COSTING_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d, loaded]);

  const materials: CostLine[] = d.materials.map((m) => ({ label: m.label, amount: n(m.amount) }));
  const r = costing({ materials, labor: n(d.labor), overhead: n(d.overhead), packaging: n(d.packaging), yieldUnits: n(d.yieldUnits), markupPct: n(d.markupPct) });
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setLine = (i: number, patch: Partial<Draft["materials"][number]>) => set({ materials: d.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4 rounded-2xl border border-border bg-white p-4 print:border-0">
        <Field label={t("calc.product")}>
          <Input value={d.product} onChange={(e) => set({ product: e.target.value })} placeholder={t("calc.product_ph")} maxLength={80} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-brand-dark">{t("calc.materials")}</legend>
          <p className="text-xs text-muted-foreground">{t("calc.materials_hint")}</p>
          {d.materials.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label={t("calc.item")} value={m.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder={t("calc.item_ph")} className="flex-1" maxLength={60} />
              <Input aria-label={t("calc.cost")} type="number" inputMode="decimal" min={0} step="0.01" value={m.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="₱" className="w-28" />
              <button type="button" aria-label={t("upload.remove")} disabled={d.materials.length === 1} onClick={() => set({ materials: d.materials.filter((_, j) => j !== i) })} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-soft disabled:opacity-30 print:hidden">
                <Trash2 size={18} aria-hidden />
              </button>
            </div>
          ))}
          {d.materials.length < 30 && (
            <button type="button" onClick={() => set({ materials: [...d.materials, { label: "", amount: "" }] })} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand print:hidden">
              <Plus size={16} aria-hidden /> {t("calc.add_item")}
            </button>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("calc.labor")} hint={t("calc.per_batch")}><Input type="number" inputMode="decimal" min={0} value={d.labor} onChange={(e) => set({ labor: e.target.value })} placeholder="₱" /></Field>
          <Field label={t("calc.overhead")} hint={t("calc.overhead_hint")}><Input type="number" inputMode="decimal" min={0} value={d.overhead} onChange={(e) => set({ overhead: e.target.value })} placeholder="₱" /></Field>
          <Field label={t("calc.packaging")} hint={t("calc.per_batch")}><Input type="number" inputMode="decimal" min={0} value={d.packaging} onChange={(e) => set({ packaging: e.target.value })} placeholder="₱" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("calc.yield")} hint={t("calc.yield_hint")}><Input type="number" inputMode="numeric" min={1} value={d.yieldUnits} onChange={(e) => set({ yieldUnits: e.target.value })} placeholder="24" /></Field>
          <Field label={t("calc.markup")} hint={t("calc.markup_hint")}>
            <div className="flex gap-1.5">
              <Input type="number" inputMode="decimal" min={0} value={d.markupPct} onChange={(e) => set({ markupPct: e.target.value })} className="w-24" />
              {["30", "50", "100"].map((p) => (
                <button key={p} type="button" onClick={() => set({ markupPct: p })} className={cn("min-h-11 rounded-xl border px-3 text-sm font-semibold print:hidden", d.markupPct === p ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-muted")}>{p}%</button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <aside aria-live="polite" className="h-fit space-y-3 rounded-2xl bg-brand-dark p-5 text-white lg:sticky lg:top-32">
        <h2 className="font-bold">{d.product || t("calc.result")}</h2>
        {r ? (
          <>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-white/75">{t("calc.batch_cost")}</dt><dd className="font-semibold">{formatPeso(r.batchCost)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/75">{t("calc.unit_cost")}</dt><dd className="font-semibold">{formatPeso(r.unitCost)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/75">{t("calc.wholesale")}</dt><dd className="font-semibold">{formatPeso(r.wholesalePrice)}</dd></div>
            </dl>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-white/75">{t("calc.price")}</p>
              <p className="text-3xl font-extrabold text-accent">{formatPeso(r.price)}</p>
              <p className="text-xs text-white/80">{t("calc.profit_line", { profit: formatPeso(r.profitPerUnit), margin: r.marginPct })}</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link
                href="/sell/tools/break-even"
                onClick={() => {
                  try {
                    localStorage.setItem(HANDOFF_KEY, JSON.stringify({ price: r.price, variableCost: r.unitCost }));
                  } catch {
                    /* ignore */
                  }
                }}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-accent px-3 text-sm font-bold text-brand-dark hover:bg-[#ea6a0c]"
              >
                {t("calc.to_break_even")}
              </Link>
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/30 px-3 text-sm font-semibold hover:bg-white/10">
                <Printer size={16} aria-hidden /> {t("calc.print")}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/80">{t("calc.need_yield")}</p>
        )}
        <button type="button" onClick={() => setD(EMPTY)} className="text-xs text-white/70 underline print:hidden">{t("calc.reset")}</button>
      </aside>
    </div>
  );
}
