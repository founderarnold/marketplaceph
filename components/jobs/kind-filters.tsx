import type { TFunction } from "@/lib/i18n/shared";
import { JOB_KIND_FILTERS, type JobKindFilter } from "@/lib/jobs";

const chip = "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft";

/** Checkboxes on Find jobs: Urgent hiring plus Work from home, Part-time, Seasonal and On-call (any ticked box matches). */
export function JobKindFilters({ urgent, kinds, t, showUrgent = true }: { urgent: boolean; kinds: JobKindFilter[]; t: TFunction; showUrgent?: boolean }) {
  return (
    <fieldset className="space-y-1">
      <legend className="sr-only">{t("comp.kind.legend")}</legend>
      <div className="flex flex-wrap gap-2">
        {showUrgent && (
          <label className={chip}>
            <input type="checkbox" name="tag" value="urgent" defaultChecked={urgent} className="h-5 w-5 accent-[var(--brand)]" /> {t("job.tools.urgent_filter")}
          </label>
        )}
        {JOB_KIND_FILTERS.map((k) => (
          <label key={k} className={chip}>
            <input type="checkbox" name="kind" value={k} defaultChecked={kinds.includes(k)} className="h-5 w-5 accent-[var(--brand)]" /> {t(`comp.kind.${k}`)}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("comp.kind.hint")}</p>
    </fieldset>
  );
}
