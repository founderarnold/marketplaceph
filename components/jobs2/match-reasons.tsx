import { Sparkles } from "lucide-react";
import type { TFunction } from "@/lib/i18n/shared";
import { type MatchReason, reasonText } from "@/lib/jobs-match";

/** "Why this may fit you" chips. Shown only to the signed-in member; never used to hide jobs. */
export function MatchReasons({ reasons, t, max = 3 }: { reasons: MatchReason[]; t: TFunction; max?: number }) {
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs" aria-label={t("job5.why.title")}>
      <Sparkles size={14} className="text-accent-strong" aria-hidden />
      <span className="sr-only">{t("job5.why.title")}:</span>
      {reasons.slice(0, max).map((r) => <span key={r.key} className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">{reasonText(r, t)}</span>)}
    </div>
  );
}
