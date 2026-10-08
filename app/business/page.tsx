import { AlertTriangle, BarChart3, Bell, Boxes, CircleDollarSign, Lock, MessageSquareText, Truck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProBadge } from "@/components/business/pro-note";
import { buttonClass } from "@/components/ui/button";
import { businessContext, daysAgoIso, isoDay, peso } from "@/lib/business";

export const metadata: Metadata = { title: "My business" };

export default async function BusinessHome() {
  const { supabase, userId, can, tier, store, t } = await businessContext();
  const pro = can("sms");
  const today = new Date();
  const monthStart = isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

  const [sales, crm, listings, sellerTodo, buyerTodo, myReminders] = await Promise.all([
    store ? supabase.rpc("seller_sales_summary", { p_store: store.id, p_from: monthStart < daysAgoIso(31) ? daysAgoIso(31) : monthStart, p_to: isoDay(today) }) : Promise.resolve({ data: null }),
    store ? supabase.rpc("crm_list", { p_store: store.id }) : Promise.resolve({ data: null }),
    store ? supabase.from("listings").select("quantity_on_hand, low_stock_threshold").eq("store_id", store.id).neq("status", "removed") : Promise.resolve({ data: null }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", userId).in("status", ["requested", "payment_submitted", "paid", "packed"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", userId).in("status", ["quoted", "shipped", "delivered"]),
    supabase.from("restock_reminders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("enabled", true),
  ]);
  const s = sales.data?.[0];
  const low = (listings.data ?? []).filter((l) => l.quantity_on_hand !== null && l.quantity_on_hand <= (l.low_stock_threshold ?? 5)).length;

  const cards = [
    { href: "/business/customers", icon: Users, title: t("biz.nav.customers"), body: t("biz.card.customers"), stat: store ? String(crm.data?.length ?? 0) : undefined },
    { href: "/business/suppliers", icon: Truck, title: t("biz.nav.suppliers"), body: t("biz.card.suppliers") },
    { href: "/business/reminders", icon: Bell, title: t("biz.nav.reminders"), body: t("biz.card.reminders"), stat: String(myReminders.count ?? 0) },
    { href: "/business/reports", icon: BarChart3, title: t("biz.nav.reports"), body: t("biz.card.reports") },
    { href: "/business/finance", icon: CircleDollarSign, title: t("biz.nav.finance"), body: t("biz.card.finance") },
    { href: "/business/inventory", icon: Boxes, title: t("biz.nav.inventory"), body: t("biz.card.inventory"), stat: store ? (low ? `${low} ⚠` : "OK") : undefined },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("biz.intro")}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${tier.rank > 0 ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>{tier.name}</span>
      </div>

      {(sellerTodo.count ?? 0) + (buyerTodo.count ?? 0) > 0 && (
        <Link href="/orders" className="flex items-center gap-3 rounded-2xl bg-accent-soft p-4 font-semibold text-accent-strong">
          <AlertTriangle size={20} aria-hidden />
          {t("biz.todo", { seller: sellerTodo.count ?? 0, buyer: buyerTodo.count ?? 0 })}
        </Link>
      )}

      {store && s && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("biz.this_month")}>
          {[
            [t("biz.sales"), peso(s.revenue)],
            [t("biz.orders"), String(s.orders_count)],
            [t("biz.avg_order"), peso(s.avg_order)],
            [t("biz.new_customers"), String(s.new_customers)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-muted p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="text-lg font-extrabold text-brand-dark">{v}</p>
            </div>
          ))}
          <p className="col-span-full text-xs text-muted-foreground">{t("biz.this_month_note")}</p>
        </section>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map(({ href, icon: Icon, title, body, stat }) => (
          <li key={href}>
            <Link href={href} className="flex h-full gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow hover:shadow-md">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon size={22} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-bold text-brand-dark">{title}{stat && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{stat}</span>}</span>
                <span className="block text-sm text-muted-foreground">{body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Advanced features: SMS setup is Pro only */}
      <section className="space-y-3 rounded-2xl border border-border bg-white p-4" aria-labelledby="adv-h">
        <h2 id="adv-h" className="flex items-center gap-2 font-bold text-brand-dark">{t("biz.advanced")} <ProBadge t={t} need="sms" /></h2>
        <p className="text-sm text-muted-foreground">{t("biz.advanced_body")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/business/sms" className={buttonClass(pro ? "primary" : "outline", "md", "gap-2")}>
            {!pro && <Lock size={16} aria-hidden />}
            <MessageSquareText size={18} aria-hidden /> {t("biz.sms_setup")}
          </Link>
          {!pro && <Link href="/business/plan" className={buttonClass("accent", "md")}>{t("pro.subscribe")}</Link>}
        </div>
        {!pro && <p className="text-sm font-semibold text-accent-strong">{t("sms.free_note")}</p>}
      </section>
    </div>
  );
}
