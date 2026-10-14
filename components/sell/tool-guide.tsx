import { BookOpen, Lightbulb } from "lucide-react";
import type { TFunction } from "@/lib/i18n/shared";
import { toolByKey } from "@/lib/seller-tools";
import { cn } from "@/lib/utils";

/**
 * "How to use this" box for a seller tool: numbered steps plus one practical tip (guide.<key>.1… and guide.<key>.tip).
 * A native <details>, so it works without JavaScript; open by default for tools sellers are new to.
 */
export function ToolGuide({ toolKey, t, open, className }: { toolKey: string; t: TFunction; open?: boolean; className?: string }) {
  const tool = toolByKey(toolKey);
  const steps = Array.from({ length: tool.guideSteps }, (_, i) => t(`guide.${toolKey}.${i + 1}`));
  return (
    <details open={open} className={cn("group rounded-2xl border border-brand/20 bg-brand-soft/60", className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-bold text-brand-dark [&::-webkit-details-marker]:hidden">
        <BookOpen size={18} className="text-brand" aria-hidden />
        {t("guide.how_to")}
        <span className="ml-auto text-xs font-semibold text-brand group-open:hidden">{t("guide.show")}</span>
        <span className="ml-auto hidden text-xs font-semibold text-brand group-open:inline">{t("guide.hide")}</span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <p className="flex gap-2 rounded-xl bg-white p-3 text-sm text-foreground">
          <Lightbulb size={18} className="shrink-0 text-accent-strong" aria-hidden />
          <span><b>{t("guide.tip")}:</b> {t(`guide.${toolKey}.tip`)}</span>
        </p>
      </div>
    </details>
  );
}
