import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TFunction } from "@/lib/i18n/shared";
import type { StockStatus } from "@/lib/domain";

const stockTone = { in_stock: "success", made_to_order: "brand", pre_order: "accent", out_of_stock: "neutral" } as const;

export function StockBadge({ status, qty, t }: { status: StockStatus; qty?: number | null; t: TFunction }) {
  return (
    <Badge tone={stockTone[status]}>
      {t(`stock.${status}`)}
      {status === "in_stock" && qty != null && qty > 0 ? ` · ${qty}` : ""}
    </Badge>
  );
}

export function SellerTypeBadge({ type, t }: { type: string; t: TFunction }) {
  return <Badge tone="brand">{t(`seller.${type}`)}</Badge>;
}

/** Verification level: 0 none, 1 phone, 2 ID, 3 business. Shown everywhere a store appears. */
export function VerificationBadge({ level, t }: { level: number; t: TFunction }) {
  if (level <= 0) return <Badge tone="neutral">{t("verify.none")}</Badge>;
  const key = level >= 3 ? "verify.business" : level === 2 ? "verify.id" : "verify.phone";
  return (
    <Badge tone={level >= 2 ? "success" : "brand"}>
      <BadgeCheck size={14} aria-hidden /> {t(key)}
    </Badge>
  );
}
