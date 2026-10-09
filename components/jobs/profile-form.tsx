"use client";

import { useActionState } from "react";
import { saveJobProfile } from "@/app/actions/jobs";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { CIVIL_STATUSES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, SEX_OPTIONS } from "@/lib/jobs";

export type JobProfile = {
  full_name: string; headline: string | null; phone: string | null; contact_email: string | null; birthdate: string | null; sex: string | null;
  civil_status: string | null; region_code: string | null; province_code: string | null; city_code: string | null; address_note: string | null;
  about: string | null; education_level: string | null; skills: string[]; experience_years: number | null; desired_roles: string | null;
  job_types: string[]; expected_salary_min: number | string | null; expected_salary_max: number | string | null;
  work_history: { company?: string; role?: string; from?: string; to?: string; notes?: string }[]; open_to_work: boolean; consent_at: string | null;
};

const section = "space-y-3 rounded-2xl border border-border bg-white p-4";

export function JobProfileForm({ profile, locations, defaultName }: { profile: JobProfile | null; locations: Locations; defaultName: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(saveJobProfile, undefined);
  const v = state?.values ?? {};
  const val = (k: keyof JobProfile, fallback = ""): string => v[k] ?? (profile?.[k] != null ? String(profile[k]) : fallback);
  const history = profile?.work_history ?? [];

  return (
    <form action={action} className="space-y-4">
      <section className={section} aria-labelledby="pf-basic">
        <h2 id="pf-basic" className="font-bold text-brand-dark">{t("job.pf.basic")}</h2>
        <Field label={t("job.pf.full_name")}><Input name="full_name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={val("full_name", defaultName)} /></Field>
        <Field label={t("job.pf.headline")} hint={t("job.pf.headline_hint")}><Input name="headline" maxLength={100} placeholder={t("job.pf.headline_ph")} defaultValue={val("headline")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("job.pf.phone")}><Input name="phone" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="09XX XXX XXXX" defaultValue={val("phone")} /></Field>
          <Field label={t("job.pf.email")}><Input name="contact_email" type="email" maxLength={120} autoComplete="email" defaultValue={val("contact_email")} /></Field>
          <Field label={t("job.pf.birthdate")}><Input name="birthdate" type="date" max={new Date(Date.UTC(new Date().getUTCFullYear() - 15, 11, 31)).toISOString().slice(0, 10)} defaultValue={val("birthdate")} /></Field>
          <Field label={t("job.pf.sex")}>
            <Select name="sex" defaultValue={val("sex")}>
              <option value="">—</option>
              {SEX_OPTIONS.map((o) => <option key={o} value={o}>{t(`job.sex.${o}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("job.pf.civil")}>
            <Select name="civil_status" defaultValue={val("civil_status")}>
              <option value="">—</option>
              {CIVIL_STATUSES.map((o) => <option key={o} value={o}>{t(`job.civil.${o}`)}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      <section className={section} aria-labelledby="pf-where">
        <h2 id="pf-where" className="font-bold text-brand-dark">{t("job.pf.where")}</h2>
        <LocationSelect locations={locations} defaultValue={{ region: val("region_code"), province: val("province_code"), city: val("city_code") }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
        <Field label={t("job.pf.address")} hint={t("job.pf.address_hint")}><Input name="address_note" maxLength={200} defaultValue={val("address_note")} /></Field>
      </section>

      <section className={section} aria-labelledby="pf-about">
        <h2 id="pf-about" className="font-bold text-brand-dark">{t("job.pf.about_title")}</h2>
        <Field label={t("job.pf.about")} hint={t("job.pf.about_hint")}><Textarea name="about" maxLength={1500} rows={4} defaultValue={val("about")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("job.pf.education")}>
            <Select name="education_level" defaultValue={val("education_level")}>
              <option value="">—</option>
              {EDUCATION_LEVELS.map((o) => <option key={o} value={o}>{t(`job.edu.${o}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("job.pf.experience")} hint={t("job.pf.experience_hint")}><Input name="experience_years" type="number" inputMode="numeric" min={0} max={60} defaultValue={val("experience_years")} /></Field>
        </div>
        <Field label={t("job.pf.skills")} hint={t("job.pf.skills_hint")}><Input name="skills" maxLength={400} placeholder={t("job.pf.skills_ph")} defaultValue={v.skills ?? (profile?.skills ?? []).join(", ")} /></Field>
      </section>

      <section className={section} aria-labelledby="pf-work">
        <h2 id="pf-work" className="font-bold text-brand-dark">{t("job.pf.history")}</h2>
        <p className="text-sm text-muted-foreground">{t("job.pf.history_hint")}</p>
        {[0, 1, 2].map((i) => (
          <fieldset key={i} className="grid gap-2 rounded-xl bg-muted p-3 sm:grid-cols-2">
            <legend className="px-1 text-xs font-semibold text-muted-foreground">{t("job.pf.history_n", { n: i + 1 })}</legend>
            <Input name={`wh_company_${i}`} maxLength={80} aria-label={t("job.pf.company")} placeholder={t("job.pf.company")} defaultValue={v[`wh_company_${i}`] ?? history[i]?.company ?? ""} />
            <Input name={`wh_role_${i}`} maxLength={80} aria-label={t("job.pf.role")} placeholder={t("job.pf.role")} defaultValue={v[`wh_role_${i}`] ?? history[i]?.role ?? ""} />
            <Input name={`wh_from_${i}`} maxLength={10} aria-label={t("job.pf.from")} placeholder={t("job.pf.from")} defaultValue={v[`wh_from_${i}`] ?? history[i]?.from ?? ""} />
            <Input name={`wh_to_${i}`} maxLength={10} aria-label={t("job.pf.to")} placeholder={t("job.pf.to")} defaultValue={v[`wh_to_${i}`] ?? history[i]?.to ?? ""} />
            <Input name={`wh_notes_${i}`} maxLength={300} className="sm:col-span-2" aria-label={t("job.pf.notes")} placeholder={t("job.pf.notes")} defaultValue={v[`wh_notes_${i}`] ?? history[i]?.notes ?? ""} />
          </fieldset>
        ))}
      </section>

      <section className={section} aria-labelledby="pf-want">
        <h2 id="pf-want" className="font-bold text-brand-dark">{t("job.pf.want")}</h2>
        <Field label={t("job.pf.desired")} hint={t("job.pf.desired_hint")}><Input name="desired_roles" maxLength={200} defaultValue={val("desired_roles")} /></Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("job.pf.types")}</legend>
          <div className="flex flex-wrap gap-2">
            {EMPLOYMENT_TYPES.map((o) => (
              <label key={o} className="flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm">
                <input type="checkbox" name="job_types" value={o} defaultChecked={(profile?.job_types ?? []).includes(o)} className="h-4 w-4 accent-[var(--brand)]" /> {t(`job.type.${o}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("job.pf.salary_min")}><Input name="expected_salary_min" type="number" inputMode="numeric" min={0} defaultValue={val("expected_salary_min")} /></Field>
          <Field label={t("job.pf.salary_max")}><Input name="expected_salary_max" type="number" inputMode="numeric" min={0} defaultValue={val("expected_salary_max")} /></Field>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-success-soft p-3 text-sm">
          <input type="checkbox" name="open_to_work" defaultChecked={profile?.open_to_work ?? true} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
          <span><b>{t("job.pf.open")}</b> {t("job.pf.open_hint")}</span>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border-2 border-accent/60 bg-accent-soft p-4" aria-labelledby="pf-consent">
        <h2 id="pf-consent" className="font-bold text-brand-dark">{t("job.pf.privacy_title")}</h2>
        <p className="text-sm">{t("job.pf.privacy_body")}</p>
        <label className="flex items-start gap-3 text-sm font-semibold">
          <input type="checkbox" name="consent" required defaultChecked={!!profile?.consent_at} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
          <span>{t("job.pf.consent")}</span>
        </label>
      </section>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {state.error === "invalid" ? t("job.pf.invalid") : state.error === "consent" ? t("job.pf.need_consent") : state.error === "failed" ? t("common.error") : state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">✓ {t("job.pf.saved")}</p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? t("job.pf.saving") : t("job.pf.save")}</Button>
    </form>
  );
}
