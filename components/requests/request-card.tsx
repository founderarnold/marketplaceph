import { CalendarClock, MapPin, MessageSquareQuote, Package, Wrench } from "lucide-react";
import Link from "next/link";
import { formatPeso, timeAgo } from "@/lib/format";
import type { TFunction } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

export const REQUEST_CARD_SELECT =
  "id, buyer_id, kind, title, details, quantity, unit, budget_min, budget_max, needed_by, status, expires_at, created_at, categories ( name_en, name_fil ), psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )";

export type RequestCardData = {
  id: string;
  buyer_id: string;
  kind: string;
  title: string;
  details: string | null;
  quantity: number | null;
  unit: string | null;
  budget_min: number | null;
  budget_max: number | null;
  needed_by: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  categories: { name_en: string; name_fil: string } | null;
  psgc_cities: { name: string } | null;
  psgc_provinces: { name: string } | null;
  psgc_regions: { short_name: string } | null;
};

export function budgetLabel(r: Pick<RequestCardData, "budget_min" | "budget_max">, t: TFunction): string {
  const a = r.budget_min != null ? Number(r.budget_min) : null;
  const b = r.budget_max != null ? Number(r.budget_max) : null;
  if (a == null && b == null) return t("rq.budget_open");
  if (a != null && b != null && a !== b) return `${formatPeso(a)} – ${formatPeso(b)}`;
  return a != null && b == null ? t("rq.budget_from", { n: formatPeso(a) }) : formatPeso((b ?? a)!);
}

export const placeOf = (r: Pick<RequestCardData, "psgc_cities" | "psgc_provinces" | "psgc_regions">) =>
  [r.psgc_cities?.name, r.psgc_provinces?.name, r.psgc_regions?.short_name].filter(Boolean).join(", ");

export const isOpen = (r: Pick<RequestCardData, "status" | "expires_at">) => r.status === "open" && new Date(r.expires_at).getTime() > Date.now();

export function RequestCard({ r, offers, t, locale, compact }: { r: RequestCardData; offers: number; t: TFunction; locale: string; compact?: boolean }) {
  const open = isOpen(r);
  const where = placeOf(r);
  const Icon = r.kind === "service" ? Wrench : Package;
  return (
    <Link href={`/looking-for/${r.id}`} className={cn("flex h-full flex-col rounded-2xl border bg-white p-4 transition-shadow hover:border-brand hover:shadow-md", open ? "border-border" : "border-border opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">
          <Icon size={13} aria-hidden /> {t(`rq.kind.${r.kind}`)}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", open ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
          {open ? t("rq.status.open") : t(`rq.status.${r.status === "open" ? "expired" : r.status}`)}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-2 font-bold text-brand-dark">{r.title}</h3>
      {!compact && r.details && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.details}</p>}
      <dl className="mt-2 space-y-0.5 text-sm">
        {r.quantity != null && (
          <div><dt className="inline text-muted-foreground">{t("rq.quantity")}: </dt><dd className="inline font-semibold">{Number(r.quantity).toLocaleString("en-PH")} {r.unit}</dd></div>
        )}
        <div><dt className="inline text-muted-foreground">{t("rq.budget")}: </dt><dd className="inline font-semibold">{budgetLabel(r, t)}</dd></div>
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted-foreground">
        {where && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden /> {where}</span>}
        {r.needed_by && <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden /> {t("rq.by_date", { date: new Date(`${r.needed_by}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" }) })}</span>}
        <span className="inline-flex items-center gap-1 font-semibold text-brand"><MessageSquareQuote size={12} aria-hidden /> {t(offers === 1 ? "rq.offers_one" : "rq.offers_n", { n: offers })}</span>
        <span>{timeAgo(r.created_at)}</span>
        {r.categories && <span>{locale === "fil" ? r.categories.name_fil : r.categories.name_en}</span>}
      </div>
    </Link>
  );
}
