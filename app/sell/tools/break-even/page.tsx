import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ProNote } from "@/components/business/pro-note";
import { BreakEvenCalculator } from "@/components/sell/break-even-calculator";
import { ToolGuide } from "@/components/sell/tool-guide";
import { ToolHeader } from "@/components/sell/tool-header";
import { businessContext } from "@/lib/business";

export const metadata: Metadata = { title: "Break-even calculator" };

async function BreakEvenPageContent() {
  const { can, t } = await businessContext();
  const allowed = can("break_even");
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <ToolHeader toolKey="break_even" t={t} />
      <ToolGuide toolKey="break_even" t={t} open={!allowed} className="print:hidden" />
      {allowed ? <BreakEvenCalculator /> : <ProNote t={t} need="break_even" feature={t("sell.locked_body")} />}
    </div>
  );
}

export default function BreakEvenPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BreakEvenPageContent />
    </Suspense>
  );
}
