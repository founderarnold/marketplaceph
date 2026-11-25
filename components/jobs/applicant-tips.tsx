import { Lightbulb, UserRoundCheck } from "lucide-react";
import type { TFunction } from "@/lib/i18n/shared";

const FIRST_TIME = ["1", "2", "3", "4", "5", "6", "7"] as const;
const PROFILE = ["1", "2", "3", "4"] as const;
const BUTTONS = ["apply", "profile", "save", "follow", "reapply", "share", "messages"] as const;

/**
 * Plain-language help for job seekers: tips for first-time applicants, why a good profile helps, and what each
 * button does. Folded by default so it never pushes the jobs down; `open` unfolds the first part.
 */
export function ApplicantTips({ t, open = false, buttons = false, compact = false }: { t: TFunction; open?: boolean; buttons?: boolean; compact?: boolean }) {
  const box = "group rounded-2xl border border-border bg-white p-3";
  const sum = "flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-brand-dark [&::-webkit-details-marker]:hidden";
  return (
    <section aria-label={t("comp.tips.title")} className={compact ? "space-y-2" : "grid gap-2 md:grid-cols-2"}>
      <details className={box} open={open}>
        <summary className={sum}><Lightbulb size={18} className="shrink-0 text-accent-strong" aria-hidden /> {t("comp.tips.first_title")}</summary>
        <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
          {FIRST_TIME.map((n) => <li key={n}>{t(`comp.tips.first_${n}`)}</li>)}
        </ol>
      </details>
      <details className={box}>
        <summary className={sum}><UserRoundCheck size={18} className="shrink-0 text-success" aria-hidden /> {t("comp.tips.profile_title")}</summary>
        <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {PROFILE.map((n) => <li key={n}>{t(`comp.tips.profile_${n}`)}</li>)}
        </ul>
      </details>
      {buttons && (
        <details className={`${box} ${compact ? "" : "md:col-span-2"}`}>
          <summary className={sum}>{t("comp.tips.buttons_title")}</summary>
          <dl className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
            {BUTTONS.map((b) => (
              <div key={b} className="rounded-xl bg-muted p-2">
                <dt className="font-bold text-brand-dark">{t(`comp.btn.${b}`)}</dt>
                <dd className="text-muted-foreground">{t(`comp.tips.btn_${b}`)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
