import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import { ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignInButton } from "@/components/auth/auth-modal";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { FEATURE_MIN_RANK, TIERS, tierFor } from "@/lib/plans";
import { SELLER_TOOLS, type SellerTool } from "@/lib/seller-tools";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sell on MarketplacePH",
  description: "Post for free, manage your store, chat with buyers and run your business with costing, break-even, inventory, expenses and staff time tools.",
};

/** Public seller hub: how to start selling, and every seller tool with what it does and which plan includes it. */
async function SellHubContent() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const signedIn = !!claims?.claims;
  const rank = signedIn ? ((await supabase.rpc("my_tier")).data?.[0]?.rank ?? 0) : null;
  const cheapestPaid = TIERS.find((x) => x.rank === 1)!;

  const card = (tool: SellerTool) => {
    const Icon = tool.icon;
    const min = tool.feature ? FEATURE_MIN_RANK[tool.feature] : 0;
    const locked = min > 0 && (rank === null || rank < min);
    return (
      <li key={tool.key}>
        <Link href={tool.href} className="group flex h-full flex-col rounded-2xl border border-border bg-white p-4 transition-shadow hover:border-brand hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={22} aria-hidden /></span>
            {min > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-extrabold uppercase text-accent-strong">
                {locked && <Lock size={11} aria-hidden />} {tierFor(tool.feature!).name.replace("FLAME ", "")}+
              </span>
            ) : (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-extrabold uppercase text-success">{t("sell.free")}</span>
            )}
          </div>
          <h3 className="mt-3 font-extrabold text-brand-dark group-hover:text-brand">{t(`sell.tool.${tool.key}.title`)}</h3>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">{t(`sell.tool.${tool.key}.desc`)}</p>
          <span className="mt-3 flex items-center gap-0.5 text-sm font-bold text-brand">
            {t("sell.open")} <ChevronRight size={16} aria-hidden />
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <section className="-mx-4 -mt-4 bg-gradient-to-br from-brand-dark via-brand to-brand-sky px-4 py-10 text-white md:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">{t("sell.hub_title")}</h1>
          <p className="mt-3 text-base text-white/90 md:text-lg">{t("sell.hub_sub")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/sell/new" className={buttonClass("accent", "lg", "rounded-full")}>{t("nav.post_free")}</Link>
            {signedIn ? (
              <Link href="/business" className="inline-flex h-12 items-center rounded-full bg-white px-6 font-bold text-brand-dark hover:bg-accent-soft">{t("sell.tool.dashboard.title")}</Link>
            ) : (
              <SignInButton mode="signup" className="inline-flex h-12 items-center rounded-full bg-white px-6 font-bold text-brand-dark hover:bg-accent-soft">{t("nav.create_account")}</SignInButton>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-h">
        <h2 id="steps-h" className="mb-3 text-xl font-bold text-brand-dark">{t("sell.steps_title")}</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="rounded-2xl border border-border bg-white p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-lg font-extrabold text-brand-dark">{n}</span>
              <h3 className="mt-2 font-bold text-brand-dark">{t(`sell.step${n}_title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(`sell.step${n}_body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="basics-h">
        <h2 id="basics-h" className="text-xl font-bold text-brand-dark">{t("sell.group.basics")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("sell.group.basics_sub")}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SELLER_TOOLS.filter((x) => x.group === "basics").map(card)}</ul>
      </section>

      <section aria-labelledby="biz-h">
        <h2 id="biz-h" className="text-xl font-bold text-brand-dark">{t("sell.group.business")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("sell.group.business_sub")}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SELLER_TOOLS.filter((x) => x.group === "business").map(card)}</ul>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-3xl border-2 border-accent bg-accent-soft p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-brand-dark">{t("sell.plans_title")}</h2>
          <p className="text-sm text-foreground">{t("sell.plans_body", { price: cheapestPaid.monthly })}</p>
        </div>
        <Link href="/business/plan" className={buttonClass("accent", "lg", "shrink-0 rounded-full")}>{t("sell.plans_cta")}</Link>
      </section>
      <p className="text-center text-sm">
        <Link href="/faq#selling" className="font-semibold text-brand underline">{t("faq.seller_help")}</Link>
      </p>
    </div>
  );
}

export default function SellHub() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SellHubContent />
    </Suspense>
  );
}
