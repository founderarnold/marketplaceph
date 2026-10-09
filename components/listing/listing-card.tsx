import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import { StockBadge, VerificationBadge } from "@/components/listing/badges";
import type { ListingCardData } from "@/lib/domain";
import { priceLabel } from "@/lib/format";
import type { TFunction } from "@/lib/i18n/shared";
import { firstThumb } from "@/lib/images";
import { cn } from "@/lib/utils";

/** `priority` marks above-the-fold cards: eager-load their image (the first one is the likely LCP element). */
export function ListingCard({ l, t, priority }: { l: ListingCardData; t: TFunction; priority?: "high" | "eager" }) {
  const soldOut = l.stock_status === "out_of_stock";
  return (
    <Link
      href={`/listing/${l.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={firstThumb(l.listing_images)}
          alt={l.title}
          width={400}
          height={400}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority === "high" ? "high" : undefined}
          decoding="async"
          className={cn("h-full w-full object-cover", soldOut && "opacity-60 grayscale")}
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <StockBadge status={l.stock_status} t={t} />
          {l.condition !== "new" && <Badge tone="accent">{t(`cond.${l.condition}`)}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-lg font-extrabold text-brand-dark">{priceLabel(l, t)}</p>
        <p className="line-clamp-2 text-sm font-medium text-foreground">{l.title}</p>
        {l.moq > 1 && (
          <p className="text-xs text-muted-foreground">
            {t("listing.moq")}: {l.moq} {l.unit}
          </p>
        )}
        <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted-foreground">
          <MapPin size={12} aria-hidden /> {l.psgc_cities?.name ?? "—"}
        </p>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="truncate text-xs font-medium text-foreground">{l.stores.name}</span>
          <VerificationBadge level={l.stores.verification_level} t={t} />
        </div>
      </div>
    </Link>
  );
}

export function ListingGrid({ items, t }: { items: ListingCardData[]; t: TFunction }) {
  if (items.length === 0) {
    return <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("search.empty")}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((l, i) => (
        <ListingCard key={l.id} l={l} t={t} priority={i === 0 ? "high" : i < 4 ? "eager" : undefined} />
      ))}
    </div>
  );
}
