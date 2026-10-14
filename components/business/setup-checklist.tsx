import { CheckCircle2, ChevronRight, Circle, Rocket } from "lucide-react";
import Link from "next/link";
import type { TFunction } from "@/lib/i18n/shared";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * "Get your store ready" checklist for new sellers: the five things that make buyers trust and order from a store.
 * Hidden once everything is done. With no store yet, it shows the single first step.
 */
export async function SetupChecklist({ supabase, storeId, t }: { supabase: Supabase; storeId: string | null; t: TFunction }) {
  let steps: { done: boolean; href: string; label: string }[];
  if (!storeId) {
    steps = [{ done: false, href: "/sell/new", label: t("setup.store") }];
  } else {
    const [{ data: store }, listings, pay, ship, verif] = await Promise.all([
      supabase.from("stores").select("logo_url, description, contact_phone, verification_level").eq("id", storeId).single(),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "active"),
      supabase.from("store_payment_methods").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("store_shipping_methods").select("method_id", { count: "exact", head: true }).eq("store_id", storeId),
      supabase.from("store_verifications").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "pending"),
    ]);
    steps = [
      { done: true, href: "/my/store", label: t("setup.store") },
      { done: !!(store?.logo_url && store.description && store.contact_phone), href: "/my/store", label: t("setup.profile") },
      { done: (listings.count ?? 0) > 0, href: "/sell/new", label: t("setup.listing") },
      { done: (pay.count ?? 0) > 0 && (ship.count ?? 0) > 0, href: "/my/shipping", label: t("setup.pay_ship") },
      { done: (store?.verification_level ?? 0) > 0 || (verif.count ?? 0) > 0, href: "/sell/verify", label: t("setup.verify") },
    ];
  }
  const doneCount = steps.filter((s) => s.done).length;
  if (storeId && doneCount === steps.length) return null;

  return (
    <section aria-labelledby="setup-h" className="rounded-2xl border-2 border-accent bg-accent-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="setup-h" className="flex items-center gap-2 font-extrabold text-brand-dark">
          <Rocket size={20} className="text-accent-strong" aria-hidden /> {t("setup.title")}
        </h2>
        {storeId && <span className="text-sm font-bold text-accent-strong">{doneCount}/{steps.length}</span>}
      </div>
      {storeId && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label={t("setup.title")}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      )}
      <ol className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-brand-dark hover:bg-brand-soft">
              {s.done ? <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden /> : <Circle size={18} className="shrink-0 text-muted-foreground" aria-hidden />}
              <span className={s.done ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{s.label}</span>
              {!s.done && <ChevronRight size={16} className="text-brand" aria-hidden />}
              <span className="sr-only">{s.done ? t("setup.done") : t("setup.todo")}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
