import type { Metadata } from "next";
import Link from "next/link";
import { SupplierForm } from "@/components/business/forms";
import { SellerTypeBadge, VerificationBadge } from "@/components/listing/badges";
import { ReorderButton } from "@/components/orders/order-panels";
import { buttonClass } from "@/components/ui/button";
import { businessContext, peso } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const { supabase, t } = await businessContext();
  const { data } = await supabase.rpc("supplier_list");
  const list = data ?? [];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.suppliers")}</h1>
        <p className="text-sm text-muted-foreground">{t("supplier.intro")}</p>
      </div>
      {list.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="text-muted-foreground">{t("supplier.empty")}</p>
          <Link href="/search" className={buttonClass("primary")}>{t("home.cta_browse")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.store_id} className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/store/${s.store_slug}`} className="text-lg font-bold text-brand-dark hover:underline">{s.favorite ? "★ " : ""}{s.store_name}</Link>
                  <p className="mt-1 flex flex-wrap gap-1"><SellerTypeBadge type={s.seller_type} t={t} /><VerificationBadge level={s.verification_level} t={t} /></p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-extrabold">{peso(s.total_spent)}</p>
                  <p className="text-muted-foreground">{t("crm.orders_n", { n: s.orders_count })} · {t("crm.last", { when: timeAgo(s.last_order_at) })}</p>
                </div>
              </div>
              {s.tags.length > 0 && <p className="flex flex-wrap gap-1">{s.tags.map((x) => <span key={x} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">#{x}</span>)}</p>}
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1"><SupplierForm storeId={s.store_id} notes={s.notes ?? ""} tags={s.tags} favorite={s.favorite} /></div>
                <div className="w-full sm:w-56">
                  {s.last_order_id ? <ReorderButton orderId={s.last_order_id} /> : <Link href={`/store/${s.store_slug}`} className={buttonClass("accent", "md", "w-full")}>{t("supplier.visit")}</Link>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
