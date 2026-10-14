import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ProBadge } from "@/components/business/pro-note";
import type { TFunction } from "@/lib/i18n/shared";
import { FEATURE_MIN_RANK } from "@/lib/plans";
import { toolByKey } from "@/lib/seller-tools";

/** Title block for a seller tool page: breadcrumb back to the Sell hub, icon, name, plan badge and what the tool does. */
export function ToolHeader({ toolKey, t }: { toolKey: string; t: TFunction }) {
  const tool = toolByKey(toolKey);
  const Icon = tool.icon;
  const paid = tool.feature ? FEATURE_MIN_RANK[tool.feature] > 0 : false;
  return (
    <div className="space-y-2">
      <nav aria-label={t("sell.breadcrumb")} className="flex items-center gap-1 text-sm text-muted-foreground print:hidden">
        <Link href="/sell" className="font-semibold text-brand hover:underline">{t("nav.sell_menu")}</Link>
        <ChevronRight size={14} aria-hidden />
        <span>{t(`sell.tool.${toolKey}.title`)}</span>
      </nav>
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand print:hidden"><Icon size={24} aria-hidden /></span>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-brand-dark">
            {t(`sell.tool.${toolKey}.title`)} {paid && <ProBadge t={t} need={tool.feature} />}
          </h1>
          <p className="text-sm text-muted-foreground">{t(`sell.tool.${toolKey}.desc`)}</p>
        </div>
      </div>
    </div>
  );
}
