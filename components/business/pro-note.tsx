import { Lock } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import type { TFunction } from "@/lib/i18n/shared";
import { tierFor, type Feature } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** The "you need to subscribe" note shown wherever a paid feature is locked; `need` names the tier that unlocks it. */
export function ProNote({ t, feature, need, className }: { t: TFunction; feature?: string; need?: Feature; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-accent/50 bg-accent-soft p-4", className)} role="note">
      <Lock className="shrink-0 text-accent-strong" size={20} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-dark">{need ? t("plan.needs_note", { tier: tierFor(need).name }) : t("pro.note")}</p>
        {feature && <p className="text-sm text-muted-foreground">{feature}</p>}
      </div>
      <Link href="/business/plan" className={buttonClass("accent", "sm")}>{t("pro.subscribe")}</Link>
    </div>
  );
}

export function ProBadge({ t, need, className }: { t: TFunction; need?: Feature; className?: string }) {
  return <span className={cn("rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark", className)}>{need ? tierFor(need).name.replace("FLAME ", "") : t("pro.badge")}</span>;
}

export function NoStore({ t }: { t: TFunction }) {
  return (
    <div className="rounded-2xl bg-muted p-6 text-center">
      <p className="text-sm text-muted-foreground">{t("biz.no_store")}</p>
      <Link href="/sell/new" className={buttonClass("accent", "md", "mt-3")}>{t("nav.post_free")}</Link>
    </div>
  );
}
