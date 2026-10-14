import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ProNote } from "@/components/business/pro-note";
import { CostingCalculator } from "@/components/sell/costing-calculator";
import { ToolGuide } from "@/components/sell/tool-guide";
import { ToolHeader } from "@/components/sell/tool-header";
import { businessContext } from "@/lib/business";

export const metadata: Metadata = { title: "Costing calculator" };

async function CostingPageContent() {
  const { can, t } = await businessContext();
  const allowed = can("costing");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <ToolHeader toolKey="costing" t={t} />
      <ToolGuide toolKey="costing" t={t} open={!allowed} className="print:hidden" />
      {allowed ? <CostingCalculator /> : <ProNote t={t} need="costing" feature={t("sell.locked_body")} />}
    </div>
  );
}

export default function CostingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CostingPageContent />
    </Suspense>
  );
}
