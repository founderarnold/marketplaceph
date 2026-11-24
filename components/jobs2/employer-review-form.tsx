"use client";

import { useActionState } from "react";
import { recordEmployerReview } from "@/app/actions/jobs2";
import { REVIEW_DOCS } from "@/lib/jobs-reviews";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

/** Reviewer checklist for one employer (full admins). Saved as an append-only record; never shown publicly. */
export function EmployerReviewForm({ employerId, isAgency }: { employerId: string; isAgency: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(recordEmployerReview, undefined);
  if (state?.ok) return <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">{t("job6.review_saved")}</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employer_id" value={employerId} />
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t("job6.docs_checked")}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {REVIEW_DOCS.map((d) => (
            <label key={d} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
              <input type="checkbox" name="documents_checked" value={d} className="h-5 w-5 accent-[var(--brand)]" /> {t(`job6.doc.${d}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="official_source_checked" className="h-5 w-5 accent-[var(--brand)]" /> {t("job6.official_checked")}</label>
      <Field label={t("job6.official_source")} hint={t("job6.official_hint")}><Input name="official_source" maxLength={120} /></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="is_agency" defaultChecked={isAgency} className="h-5 w-5 accent-[var(--brand)]" /> {t("job6.is_agency")}</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="agency_license_checked" className="h-5 w-5 accent-[var(--brand)]" /> {t("job6.agency_checked")}</label>
      <Field label={t("job6.decision")}>
        <Select name="decision" required defaultValue="">
          <option value="" disabled>—</option>
          {(["approved", "needs_more", "rejected"] as const).map((d) => <option key={d} value={d}>{t(`job6.decision.${d}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("job6.reason")}><Textarea name="reason" maxLength={500} rows={3} /></Field>
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{state.error === "agency" ? t("job6.need_licence") : state.error === "forbidden" ? t("job6.forbidden") : t("common.error")}</p>}
      <Button type="submit" disabled={pending}>{t("job6.save_review")}</Button>
    </form>
  );
}
