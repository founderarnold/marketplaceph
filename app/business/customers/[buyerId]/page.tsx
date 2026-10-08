import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { NoStore, ProNote } from "@/components/business/pro-note";
import { CrmForm, FollowUpForm } from "@/components/business/forms";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { businessContext, peso } from "@/lib/business";
import { timeAgo } from "@/lib/format";
import { STATUS_TONE } from "@/lib/orders";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage(props: PageProps<"/business/customers/[buyerId]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Customer params={props.params} />
    </Suspense>
  );
}

async function Customer({ params }: Pick<PageProps<"/business/customers/[buyerId]">, "params">) {
  const { buyerId } = await params;
  if (!z.uuid().safeParse(buyerId).success) notFound();
  const { supabase, store, can, t } = await businessContext();
  if (!store) return <NoStore t={t} />;

  const { data: list } = await supabase.rpc("crm_list", { p_store: store.id });
  const c = list?.find((x) => x.buyer_id === buyerId);
  if (!c) notFound();
  const [{ data: orders }, { data: convo }, { data: rules }] = await Promise.all([
    supabase.from("orders").select("id, summary, amount, status, created_at").eq("store_id", store.id).eq("buyer_id", buyerId).order("created_at", { ascending: false }).limit(30),
    supabase.from("conversations").select("id").eq("store_id", store.id).eq("buyer_id", buyerId).is("listing_id", null).maybeSingle(),
    supabase.from("follow_up_rules").select("id, every_days, message, enabled").eq("store_id", store.id).eq("buyer_id", buyerId),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/business/customers" className="text-sm font-semibold text-brand hover:underline">← {t("biz.nav.customers")}</Link>
      <section className="space-y-2 rounded-2xl border border-border bg-white p-4">
        <h1 className="text-2xl font-extrabold text-brand-dark">{c.display_name}</h1>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            [t("crm.total_spent"), peso(c.total_spent)],
            [t("crm.orders"), String(c.orders_count)],
            [t("crm.first"), new Date(c.first_order_at).toLocaleDateString("en-PH", { month: "short", year: "numeric" })],
            [t("crm.last_order"), timeAgo(c.last_order_at)],
          ].map(([k, v]) => <div key={k} className="rounded-xl bg-muted p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>)}
        </dl>
        {c.last_phone && <p className="text-sm">{t("checkout.phone")}: <b>{c.last_phone}</b></p>}
        <div className="flex flex-wrap gap-2">
          {convo && <Link href={`/messages/${convo.id}`} className={buttonClass("outline", "sm", "gap-2")}><MessageCircle size={16} aria-hidden /> {t("order.open_chat")}</Link>}
          <Link href={`/buyer/${buyerId}`} className={buttonClass("outline", "sm")}>{t("sheet.buyer_title")}</Link>
        </div>
      </section>

      <CrmForm storeId={store.id} buyerId={buyerId} notes={c.notes ?? ""} tags={c.tags} />

      <section className="space-y-2" aria-labelledby="fu-h">
        <h2 id="fu-h" className="text-lg font-bold text-brand-dark">{t("rem.follow_title")}</h2>
        {(rules ?? []).map((r) => <p key={r.id} className="rounded-xl bg-muted p-2 text-sm">{t("rem.every_n", { n: r.every_days })}{r.message ? ` — “${r.message}”` : ""}{!r.enabled ? ` (${t("rem.paused")})` : ""}</p>)}
        {can("follow_ups") ? <FollowUpForm storeId={store.id} customers={[]} products={[]} fixedBuyer={buyerId} /> : <ProNote t={t} need="follow_ups" feature={t("rem.follow_locked")} />}
      </section>

      <section aria-labelledby="oh">
        <h2 id="oh" className="mb-2 text-lg font-bold text-brand-dark">{t("crm.history")}</h2>
        <ul className="space-y-2">
          {(orders ?? []).map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 truncate font-semibold">{o.summary}</span>
                <span>{peso(o.amount)}</span>
                <Badge tone={STATUS_TONE[o.status]}>{t(`order.status.${o.status}`)}</Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
