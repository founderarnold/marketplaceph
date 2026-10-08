import { Download, Lock } from "lucide-react";
import { FEATURE_MIN_RANK, tierByRank } from "@/lib/plans";
import Link from "next/link";
import type { TFunction } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

/** Simple horizontal bar list (no chart library; works at any width, readable by screen readers). */
export function BarList({ rows, format }: { rows: { label: string; value: number; sub?: string }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-medium">{r.label}</span>
            <span className="shrink-0 font-bold">{format(r.value)}{r.sub && <span className="font-normal text-muted-foreground"> · {r.sub}</span>}</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="text-lg font-extrabold text-brand-dark">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** CSV / Excel / PDF links. For Free users they are locked and say why. */
export function ExportButtons({ kind, from, to, rank, t }: { kind: string; from: string; to: string; rank: number; t: TFunction }) {
  const formats = [["csv", "CSV", FEATURE_MIN_RANK.csv_export], ["xlsx", "Excel", FEATURE_MIN_RANK.excel_export], ["pdf", "PDF", FEATURE_MIN_RANK.pdf_export]] as const;
  const floor = kind === "finance" ? FEATURE_MIN_RANK.finance_pl : 0;
  const locked = formats.filter(([, , min]) => rank < Math.max(min, floor));
  const base = "btn inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("exp.title")}>
      {formats.map(([f, label, min]) =>
        rank >= Math.max(min, floor) ? (
          <a key={f} href={`/export/${kind}?format=${f}&from=${from}&to=${to}`} className={cn(base, "border-border bg-white hover:bg-muted")} download>
            <Download size={14} aria-hidden /> {label}
          </a>
        ) : (
          <Link key={f} href="/business/plan" className={cn(base, "border-dashed border-accent/60 bg-accent-soft text-accent-strong")} title={t("plan.needs", { tier: tierByRank(Math.max(min, floor)).name })}>
            <Lock size={14} aria-hidden /> {label}
          </Link>
        ),
      )}
      {locked.length > 0 && <span className="text-xs font-semibold text-accent-strong">{t("exp.tier_note", { tier: tierByRank(Math.max(locked[0][2], floor)).name })}</span>}
    </div>
  );
}

export function RangePicker({ base, from, to, presets, t }: { base: string; from: string; to: string; presets: { label: string; from: string; to: string; pro?: boolean }[]; t: TFunction }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Link key={p.label} href={`${base}?from=${p.from}&to=${p.to}`} className={cn("inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold", p.from === from && p.to === to ? "bg-brand text-white" : "bg-muted")}>
            {p.label}{p.pro && <Lock size={11} aria-hidden />}
          </Link>
        ))}
      </div>
      <form action={base} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1 font-semibold">{t("rep.from")}<input type="date" name="from" defaultValue={from} className="block h-10 rounded-xl border border-border px-2" /></label>
        <label className="space-y-1 font-semibold">{t("rep.to")}<input type="date" name="to" defaultValue={to} className="block h-10 rounded-xl border border-border px-2" /></label>
        <button className="btn h-10 rounded-xl bg-brand px-4 font-semibold text-white">{t("filters.apply")}</button>
      </form>
    </div>
  );
}
