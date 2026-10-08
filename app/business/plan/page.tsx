import { Check } from "lucide-react";
import type { Metadata } from "next";
import { RequestPlanForm } from "@/components/business/forms";
import { Badge } from "@/components/ui/badge";
import { businessContext, peso } from "@/lib/business";
import { TIERS, featuresAddedAt, yearlySaving } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

/** FLAME PH membership tiers: what you have, what each tier adds, and a request form (billing is handled manually for now). */
export default async function PlanPage() {
  const { supabase, userId, tier, periodEnd, t } = await businessContext();
  const [{ data: req }, { data: listing }, { data: aff }] = await Promise.all([
    supabase.from("plan_requests").select("plan, billing").eq("user_id", userId).eq("status", "open").maybeSingle(),
    supabase.rpc("listing_usage"),
    supabase.rpc("affiliate_quota"),
  ]);
  const used = listing?.[0]?.used ?? 0;
  const limit = listing?.[0]?.listing_limit ?? null;
  const affUsed = aff?.[0]?.used ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("plan.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("plan.intro")}</p>
      </div>

      <section className={`rounded-2xl p-4 ${tier.rank > 0 ? "bg-success-soft" : "bg-muted"}`} aria-labelledby="cur-h">
        <p id="cur-h" className="text-lg font-extrabold text-brand-dark">{t("plan.current")}: {tier.name}</p>
        {tier.rank > 0 && <p className="text-sm">{periodEnd ? t("plan.until", { date: new Date(periodEnd).toLocaleDateString("en-PH", { dateStyle: "long" }) }) : t("plan.no_end")}</p>}
        <p className="mt-1 text-sm">{limit ? t("plan.usage_listings", { used, limit }) : t("plan.usage_listings_unlimited", { used })} · {t("plan.usage_affiliates", { used: affUsed, limit: tier.affiliateLinks })}</p>
      </section>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TIERS.map((x) => {
          const mine = x.rank === tier.rank;
          return (
            <li key={x.key} className={`space-y-2 rounded-2xl border bg-white p-4 ${mine ? "border-2 border-brand" : "border-border"}`}>
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-brand-dark">{x.name} {mine && <Badge tone="success">{t("plan.yours")}</Badge>}</h2>
              <p className="text-sm text-muted-foreground">{t(`plan.tier.${x.key}`)}</p>
              <p className="font-extrabold text-brand-dark">
                {x.monthly === 0 ? t("plan.free_price") : <>{t("plan.per_month", { n: peso(x.monthly) })} <span className="text-sm font-normal text-muted-foreground">· {t("plan.per_year", { n: peso(x.yearly) })}</span></>}
              </p>
              {x.monthly > 0 && yearlySaving(x) > 0 && <p className="text-xs text-success">{t("plan.save", { n: peso(yearlySaving(x)) })}</p>}
              <ul className="space-y-1.5 text-sm">
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />{x.listings ? t("plan.limit_listings", { n: x.listings }) : t("plan.limit_listings_unlimited")}</li>
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />{t("plan.limit_affiliates", { n: x.affiliateLinks })}</li>
                {x.rank > 0 && <li className="font-semibold text-muted-foreground">{t("plan.everything_below", { tier: TIERS[x.rank - 1].name })}</li>}
                {featuresAddedAt(x.rank).filter((f) => f !== "affiliates").map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />{t(`plan.feat.${f}`)}</li>)}
              </ul>
            </li>
          );
        })}
      </ul>

      <section className="space-y-3 rounded-2xl border border-accent/50 bg-accent-soft p-4" aria-labelledby="sub-h">
        <h2 id="sub-h" className="font-bold text-brand-dark">{t("plan.subscribe_title")}</h2>
        <p className="text-sm">{t("plan.no_online_payment")}</p>
        <RequestPlanForm currentRank={tier.rank} requested={req ? { plan: req.plan, billing: req.billing } : null} />
      </section>
      <p className="text-xs text-muted-foreground">{t("plan.fair_note")}</p>
    </div>
  );
}
