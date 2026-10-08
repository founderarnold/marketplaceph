import { Lock, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FollowRuleRow, FollowUpForm, OptOutToggle, RestockForm, RestockRow, SmsOptInForm } from "@/components/business/forms";
import { ProBadge, ProNote } from "@/components/business/pro-note";
import { buttonClass } from "@/components/ui/button";
import { businessContext } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const { supabase, userId, can, store, t } = await businessContext();
  const pro = can("sms");
  const followUps = can("follow_ups");

  const [{ data: mine }, { data: suppliers }, { data: optouts }, { data: me }] = await Promise.all([
    supabase.from("restock_reminders").select("id, title, every_days, next_run_at, enabled").eq("user_id", userId).order("next_run_at"),
    supabase.rpc("supplier_list"),
    supabase.from("reminder_optouts").select("store_id").eq("user_id", userId),
    supabase.from("profiles").select("accepts_sms, sms_phone").eq("id", userId).single(),
  ]);
  const out = new Set((optouts ?? []).map((o) => o.store_id));

  let rules: { id: string; every_days: number; message: string | null; enabled: boolean; buyer_id: string | null; listing_id: string | null }[] = [];
  let customers: { id: string; name: string }[] = [];
  let products: { id: string; title: string }[] = [];
  let sent: { sent_at: string; sms: boolean; buyer_id: string }[] = [];
  if (store) {
    const [r, c, p, l] = await Promise.all([
      supabase.from("follow_up_rules").select("id, every_days, message, enabled, buyer_id, listing_id").eq("store_id", store.id).order("created_at", { ascending: false }),
      supabase.rpc("crm_list", { p_store: store.id }),
      supabase.from("listings").select("id, title").eq("store_id", store.id).eq("status", "active").order("title"),
      supabase.from("follow_up_log").select("sent_at, sms, buyer_id").eq("store_id", store.id).order("sent_at", { ascending: false }).limit(10),
    ]);
    rules = r.data ?? [];
    customers = (c.data ?? []).map((x) => ({ id: x.buyer_id, name: x.display_name }));
    products = p.data ?? [];
    sent = l.data ?? [];
  }
  const nameOf = new Map(customers.map((c) => [c.id, c.name]));
  const titleOf = new Map(products.map((p) => [p.id, p.title]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.reminders")}</h1>
        <p className="text-sm text-muted-foreground">{t("rem.intro")}</p>
      </div>

      {/* SMS button: visible to everyone, Pro only to use */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold text-brand-dark">{t("rem.sms_title")} <ProBadge t={t} need="sms" /></p>
          <p className="text-sm text-muted-foreground">{t("rem.sms_body")}</p>
          {!pro && <p className="mt-1 text-sm font-semibold text-accent-strong">{t("sms.free_note")}</p>}
        </div>
        <Link href="/business/sms" className={buttonClass(pro ? "primary" : "outline", "md", "gap-2")}>
          {!pro && <Lock size={16} aria-hidden />}<MessageSquareText size={18} aria-hidden /> {t("biz.sms_setup")}
        </Link>
      </section>

      <section className="space-y-3" aria-labelledby="mine-h">
        <h2 id="mine-h" className="text-lg font-bold text-brand-dark">{t("rem.mine")}</h2>
        <p className="text-sm text-muted-foreground">{t("rem.mine_hint")}</p>
        <ul className="space-y-1.5">
          {(mine ?? []).map((r) => <RestockRow key={r.id} id={r.id} title={r.title} every={r.every_days} nextRun={r.next_run_at} enabled={r.enabled} />)}
          {!mine?.length && <li className="text-sm text-muted-foreground">{t("rem.none")}</li>}
        </ul>
        <RestockForm stores={(suppliers ?? []).map((s) => ({ id: s.store_id, name: s.store_name }))} />
      </section>

      {store && (
        <section className="space-y-3" aria-labelledby="fu-h">
          <h2 id="fu-h" className="flex items-center gap-2 text-lg font-bold text-brand-dark">{t("rem.follow_title")} <ProBadge t={t} need="follow_ups" /></h2>
          <p className="text-sm text-muted-foreground">{t("rem.follow_intro")}</p>
          {!followUps && <ProNote t={t} need="follow_ups" feature={t("rem.follow_locked")} />}
          <ul className="space-y-1.5">
            {rules.map((r) => (
              <FollowRuleRow key={r.id} id={r.id} enabled={r.enabled} every={r.every_days} message={r.message}
                label={r.buyer_id ? `${t("rem.scope.customer")}: ${nameOf.get(r.buyer_id) ?? "—"}` : `${t("rem.scope.product")}: ${titleOf.get(r.listing_id ?? "") ?? "—"}`} />
            ))}
          </ul>
          {followUps && <FollowUpForm storeId={store.id} customers={customers} products={products} />}
          {sent.length > 0 && (
            <details className="rounded-xl border border-border bg-white p-3 text-sm">
              <summary className="cursor-pointer font-semibold">{t("rem.sent_log")}</summary>
              <ul className="mt-2 space-y-1">{sent.map((s, i) => <li key={i}>{nameOf.get(s.buyer_id) ?? "—"} · {timeAgo(s.sent_at)} · {s.sms ? "SMS" : t("rem.in_app")}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="in-h">
        <h2 id="in-h" className="text-lg font-bold text-brand-dark">{t("rem.from_sellers")}</h2>
        <p className="text-sm text-muted-foreground">{t("rem.from_sellers_hint")}</p>
        <ul className="space-y-1.5">
          {(suppliers ?? []).map((s) => <OptOutToggle key={s.store_id} storeId={s.store_id} storeName={s.store_name} optedOut={out.has(s.store_id)} />)}
          {!suppliers?.length && <li className="text-sm text-muted-foreground">{t("supplier.empty")}</li>}
        </ul>
        <SmsOptInForm accepts={me?.accepts_sms ?? false} phone={me?.sms_phone ?? ""} />
      </section>
    </div>
  );
}
