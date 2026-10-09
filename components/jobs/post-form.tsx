"use client";

import { useActionState, useState } from "react";
import { createJobPost } from "@/app/actions/jobs";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { DOC_KINDS, EMPLOYMENT_TYPES, JOB_CATEGORIES, SALARY_PERIODS, WORK_SETUPS } from "@/lib/jobs";

const section = "space-y-3 rounded-2xl border border-border bg-white p-4";
const DEFAULT_DOCS = ["resume", "photo_2x2"];

export function JobPostForm({ locations, defaultCompany }: { locations: Locations; defaultCompany: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(createJobPost, undefined);
  const v = state?.values ?? {};
  const [type, setType] = useState(v.poster_type ?? "employer");

  return (
    <form action={action} className="space-y-4">
      <section className={section} aria-labelledby="jp-who">
        <h2 id="jp-who" className="font-bold text-brand-dark">{t("job.post.who")}</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("job.post.who")}>
          {(["employer", "agency"] as const).map((o) => (
            <label key={o} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${type === o ? "border-brand bg-brand-soft" : "border-border"}`}>
              <input type="radio" name="poster_type" value={o} checked={type === o} onChange={() => setType(o)} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
              <span><b className="block">{t(`job.poster.${o}`)}</b><span className="text-sm text-muted-foreground">{t(`job.poster.${o}_hint`)}</span></span>
            </label>
          ))}
        </div>
        <Field label={t("job.post.company")}><Input name="company_name" required minLength={2} maxLength={100} defaultValue={v.company_name ?? defaultCompany} /></Field>
        {type === "agency" && (
          <>
            <Field label={t("job.post.license")} hint={t("job.post.license_hint")}><Input name="agency_license_no" required minLength={3} maxLength={60} defaultValue={v.agency_license_no} /></Field>
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="for_client" defaultChecked={v.for_client === "on"} className="mt-1 h-5 w-5 accent-[var(--brand)]" /> <span>{t("job.post.for_client")}</span></label>
          </>
        )}
      </section>

      <section className={section} aria-labelledby="jp-job">
        <h2 id="jp-job" className="font-bold text-brand-dark">{t("job.post.job")}</h2>
        <Field label={t("job.post.title")}><Input name="title" required minLength={3} maxLength={120} placeholder={t("job.post.title_ph")} defaultValue={v.title} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("job.post.category")}>
            <Select name="category" required defaultValue={v.category ?? ""}>
              <option value="" disabled>—</option>
              {JOB_CATEGORIES.map((o) => <option key={o} value={o}>{t(`job.cat.${o}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("job.post.vacancies")}><Input name="vacancies" type="number" inputMode="numeric" min={1} max={1000} required defaultValue={v.vacancies ?? "1"} /></Field>
          <Field label={t("job.post.etype")}>
            <Select name="employment_type" required defaultValue={v.employment_type ?? "full_time"}>
              {EMPLOYMENT_TYPES.map((o) => <option key={o} value={o}>{t(`job.type.${o}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("job.post.setup")}>
            <Select name="work_setup" required defaultValue={v.work_setup ?? "onsite"}>
              {WORK_SETUPS.map((o) => <option key={o} value={o}>{t(`job.setup.${o}`)}</option>)}
            </Select>
          </Field>
        </div>
        <LocationSelect locations={locations} defaultValue={{ region: v.region_code, province: v.province_code, city: v.city_code }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
        <Field label={t("job.post.description")} hint={t("job.post.description_hint")}><Textarea name="description" required minLength={20} maxLength={5000} rows={6} placeholder={t("job.post.description_ph")} defaultValue={v.description} /></Field>
        <Field label={t("job.post.qualifications")} hint={t("job.post.qualifications_hint")}><Textarea name="qualifications" maxLength={3000} rows={4} placeholder={t("job.post.qualifications_ph")} defaultValue={v.qualifications} /></Field>
      </section>

      <section className={section} aria-labelledby="jp-pay">
        <h2 id="jp-pay" className="font-bold text-brand-dark">{t("job.post.pay")}</h2>
        <p className="text-sm text-muted-foreground">{t("job.post.pay_hint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("job.post.salary_min")}><Input name="salary_min" type="number" inputMode="numeric" min={0} defaultValue={v.salary_min} /></Field>
          <Field label={t("job.post.salary_max")}><Input name="salary_max" type="number" inputMode="numeric" min={0} defaultValue={v.salary_max} /></Field>
          <Field label={t("job.post.period")}>
            <Select name="salary_period" defaultValue={v.salary_period ?? "month"}>
              {SALARY_PERIODS.map((o) => <option key={o} value={o}>{t(`job.per.${o}`)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("job.post.deadline")} hint={t("job.post.deadline_hint")}><Input name="deadline" type="date" defaultValue={v.deadline} /></Field>
      </section>

      <section className={section} aria-labelledby="jp-docs">
        <h2 id="jp-docs" className="font-bold text-brand-dark">{t("job.post.docs")}</h2>
        <p className="text-sm text-muted-foreground">{t("job.post.docs_hint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {DOC_KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
              <input type="checkbox" name="requirement_docs" value={k} defaultChecked={DEFAULT_DOCS.includes(k)} className="h-5 w-5 accent-[var(--brand)]" /> {t(`job.doc.${k}`)}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border-2 border-accent/60 bg-accent-soft p-4" aria-labelledby="jp-fair">
        <h2 id="jp-fair" className="font-bold text-brand-dark">{t("job.post.fair_title")}</h2>
        <p className="text-sm">{t("job.post.fair_body")}</p>
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input type="checkbox" name="no_fees" required className="mt-1 h-5 w-5 accent-[var(--brand)]" /> <span>{t("job.post.no_fees")}</span>
        </label>
      </section>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {state.error === "invalid" ? t("job.post.invalid") : state.error === "no_fees" ? t("job.post.need_no_fees") : state.error === "failed" ? t("common.error") : state.error}
        </p>
      )}
      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending}>{pending ? t("job.post.posting") : t("job.post.submit")}</Button>
    </form>
  );
}
