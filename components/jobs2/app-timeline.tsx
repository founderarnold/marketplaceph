import type { TFunction } from "@/lib/i18n/shared";
import { timeAgo } from "@/lib/format";
import { TIMELINE } from "@/lib/jobs-match";

/** Jobs 2.0 P5 status timeline for one application: steps, last update and the next action for the applicant. */
export function AppTimeline({ status, updatedAt, t }: { status: string; updatedAt: string; t: TFunction }) {
  const ended = status === "rejected" || status === "withdrawn";
  const at = Math.max(0, TIMELINE.indexOf(status as (typeof TIMELINE)[number]));
  return (
    <div className="space-y-2">
      <ol className="flex flex-wrap gap-1 text-xs" aria-label={t("job5.tl.title")}>
        {TIMELINE.map((s, i) => {
          const done = !ended && i <= at;
          return (
            <li key={s} aria-current={!ended && i === at ? "step" : undefined}
              className={`rounded-full px-2.5 py-1 font-semibold ${done ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
              {t(`job.status.${s}`)}
            </li>
          );
        })}
        {ended && <li className="rounded-full bg-danger-soft px-2.5 py-1 font-semibold text-danger">{t(`job.status.${status}`)}</li>}
      </ol>
      <p className="text-xs text-muted-foreground">{t("job5.tl.updated", { when: timeAgo(updatedAt) })}</p>
      <p className="rounded-xl bg-brand-soft p-2 text-sm text-brand-dark"><b>{t("job5.tl.next")}</b> {t(`job5.next.${status}`)}</p>
    </div>
  );
}
