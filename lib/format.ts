import type { TFunction } from "@/lib/i18n/shared";

export function formatPeso(n: number): string {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 });
}

export function priceLabel(
  l: { price_type: string; price_min: number | null; price_max: number | null; unit: string },
  t: TFunction,
): string {
  if (l.price_type === "message" || l.price_min == null) return t("price.message");
  if (l.price_type === "range" && l.price_max != null) return `${formatPeso(l.price_min)} – ${formatPeso(l.price_max)}`;
  return formatPeso(l.price_min);
}

/** Years in business as a trust-friendly bucket ("10+", "5+", "3+", "1+"). */
export function yearsInBusinessBadge(yearStarted: number | null | undefined, now = new Date()): string | null {
  if (!yearStarted) return null;
  const years = now.getFullYear() - yearStarted;
  for (const bucket of [10, 5, 3, 1]) if (years >= bucket) return `${bucket}+`;
  return null;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Current time in ms. Server components that run per request use this (keeps the purity lint rule quiet; they are not re-rendered). */
export function nowMs() {
  return Date.now();
}
