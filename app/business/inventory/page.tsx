import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { NoStore } from "@/components/business/pro-note";
import { StockRow } from "@/components/business/forms";
import { businessContext } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { supabase, store, t } = await businessContext();
  if (!store) return <NoStore t={t} />;

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, quantity_on_hand, low_stock_threshold, stock_status")
    .eq("store_id", store.id)
    .neq("status", "removed")
    .eq("kind", "product")
    .order("title");
  const rows = listings ?? [];
  const low = rows.filter((l) => l.quantity_on_hand !== null && l.quantity_on_hand <= (l.low_stock_threshold ?? 5));
  const { data: history } = rows.length
    ? await supabase.from("inventory_adjustments").select("id, listing_id, delta, new_qty, reason, created_at").in("listing_id", rows.map((r) => r.id)).order("id", { ascending: false }).limit(12)
    : { data: [] };
  const titleOf = new Map(rows.map((r) => [r.id, r.title]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.inventory")}</h1>
        <p className="text-sm text-muted-foreground">{t("inv.intro")}</p>
      </div>
      {low.length > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-danger-soft p-3 font-semibold text-danger" role="alert">
          <AlertTriangle size={18} aria-hidden /> {t("inv.low_banner", { n: low.length })}
        </p>
      )}
      <ul className="space-y-2">
        {[...rows].sort((a, b) => Number(b.quantity_on_hand !== null && b.quantity_on_hand <= (b.low_stock_threshold ?? 5)) - Number(a.quantity_on_hand !== null && a.quantity_on_hand <= (a.low_stock_threshold ?? 5))).map((l) => (
          <StockRow key={l.id} id={l.id} title={l.title} qty={l.quantity_on_hand} threshold={l.low_stock_threshold} tracked={l.quantity_on_hand !== null} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("inv.rules")}</p>
      {(history?.length ?? 0) > 0 && (
        <details className="rounded-2xl border border-border bg-white p-4">
          <summary className="cursor-pointer font-bold text-brand-dark">{t("inv.history")}</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {history!.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{titleOf.get(h.listing_id)}</span>
                <span className={h.delta < 0 ? "text-danger" : "text-success"}>{h.delta > 0 ? "+" : ""}{h.delta} → {h.new_qty}</span>
                <span className="text-muted-foreground">{t(`inv.reason.${h.reason}`)} · {timeAgo(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
