"use client";

import Link from "next/link";
import { useActionState } from "react";
import { JobExtrasFields } from "@/components/jobs2/posting-tools";
import { adminUpdateJobPost, updateMyJobPost } from "@/app/actions/jobs";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { DOC_KINDS, EMPLOYMENT_TYPES, JOB_CATEGORIES, SALARY_PERIODS, WORK_SETUPS, hasAdminPlaceholder } from "@/lib/jobs";

const section = "space-y-3 rounded-2xl border border-border bg-white p-4";

export type AdminPost = {
  id: string; company_name: string; title: string; category: string; description: string; qualifications: string | null;
  employment_type: string; work_setup: string; region_code: string | null; province_code: string | null; city_code: string | null;
  salary_min: number | null; salary_max: number | null; salary_period: string | null; vacancies: number; deadline: string | null;
  requirement_docs: string[]; status: string; poster_type?: string; agency_license_no?: string | null;
  hiring_tags?: string[] | null; logo_url?: string | null; creative_url?: string | null;
};

/**
 * Edit a job post, published or hidden. `mode="admin"`: Admin → Jobs → Edit (full admins; every change is logged).
 * `mode="owner"`: the employer / agency that posted it (only their own posts; the database checks this too).
 */
export function AdminJobPostForm({ post, locations, mode = "admin", backHref, userId }: { post: AdminPost; locations: Locations; mode?: "admin" | "owner"; backHref?: string; userId: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(mode === "owner" ? updateMyJobPost : adminUpdateJobPost, undefined);
  const s = (v: unknown) => (v == null ? "" : String(v));
  const v: Record<string, string> = state?.values ?? Object.fromEntries(Object.entries(post).map(([k, x]) => [k, Array.isArray(x) ? "" : s(x)]));
  const locked = post.status === "removed";
  const placeholder = hasAdminPlaceholder(v.title, v.description, v.qualifications);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={post.id} />
      {locked && <p role="status" className="rounded-xl bg-muted p-3 text-sm text-brand-dark">{t("job.edit.removed")}</p>}
      {post.status === "active" && <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("job.edit.live_note")}</p>}
      {placeholder && <p role="status" className="rounded-xl bg-muted p-3 text-sm text-brand-dark">{t("job.admin.has_placeholder")}</p>}
      <fieldset disabled={locked || pending} className="space-y-4">
        <section className={section} aria-labelledby="ap-job">
          <h2 id="ap-job" className="font-bold text-brand-dark">{t("job.post.job")}</h2>
          <Field label={t("job.post.company")}><Input name="company_name" required minLength={2} maxLength={100} defaultValue={v.company_name} /></Field>
          {mode === "owner" && post.poster_type === "agency" && (
            <Field label={t("job.post.license")} hint={t("job.post.license_hint")}><Input name="agency_license_no" required minLength={3} maxLength={60} defaultValue={v.agency_license_no} /></Field>
          )}
          <Field label={t("job.post.title")}><Input name="title" required minLength={3} maxLength={120} defaultValue={v.title} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("job.post.category")}>
              <Select name="category" required defaultValue={v.category}>
                {JOB_CATEGORIES.map((o) => <option key={o} value={o}>{t(`job.cat.${o}`)}</option>)}
              </Select>
            </Field>
            <Field label={t("job.post.vacancies")}><Input name="vacancies" type="number" inputMode="numeric" min={1} max={1000} required defaultValue={v.vacancies} /></Field>
            <Field label={t("job.post.etype")}>
              <Select name="employment_type" required defaultValue={v.employment_type}>
                {EMPLOYMENT_TYPES.map((o) => <option key={o} value={o}>{t(`job.type.${o}`)}</option>)}
              </Select>
            </Field>
            <Field label={t("job.post.setup")}>
              <Select name="work_setup" required defaultValue={v.work_setup}>
                {WORK_SETUPS.map((o) => <option key={o} value={o}>{t(`job.setup.${o}`)}</option>)}
              </Select>
            </Field>
          </div>
          <LocationSelect locations={locations} defaultValue={{ region: v.region_code || undefined, province: v.province_code || undefined, city: v.city_code || undefined }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
          <Field label={t("job.post.description")} hint={t("job.post.description_hint")}><Textarea name="description" required minLength={20} maxLength={5000} rows={14} defaultValue={v.description} /></Field>
          <Field label={t("job.post.qualifications")} hint={t("job.post.qualifications_hint")}><Textarea name="qualifications" maxLength={3000} rows={6} defaultValue={v.qualifications} /></Field>
        </section>

        <section className={section} aria-labelledby="ap-pay">
          <h2 id="ap-pay" className="font-bold text-brand-dark">{t("job.post.pay")}</h2>
          <p className="text-sm text-muted-foreground">{t("job.post.pay_hint")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("job.post.salary_min")}><Input name="salary_min" type="number" inputMode="numeric" min={0} defaultValue={v.salary_min} /></Field>
            <Field label={t("job.post.salary_max")}><Input name="salary_max" type="number" inputMode="numeric" min={0} defaultValue={v.salary_max} /></Field>
            <Field label={t("job.post.period")}>
              <Select name="salary_period" defaultValue={v.salary_period || "month"}>
                {SALARY_PERIODS.map((o) => <option key={o} value={o}>{t(`job.per.${o}`)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t("job.post.deadline")} hint={t("job.post.deadline_hint")}><Input name="deadline" type="date" defaultValue={v.deadline} /></Field>
        </section>

        <JobExtrasFields userId={userId} tags={post.hiring_tags ?? []} logo={post.logo_url ?? null} creative={post.creative_url ?? null} />

        <section className={section} aria-labelledby="ap-docs">
          <h2 id="ap-docs" className="font-bold text-brand-dark">{t("job.post.docs")}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {DOC_KINDS.map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
                <input type="checkbox" name="requirement_docs" value={k} defaultChecked={post.requirement_docs.includes(k)} className="h-5 w-5 accent-[var(--brand)]" /> {t(`job.doc.${k}`)}
              </label>
            ))}
          </div>
        </section>
      </fieldset>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {state.error === "invalid" ? t("job.post.invalid") : state.error === "removed" ? t("job.edit.removed") : state.error === "forbidden" ? (mode === "owner" ? t("job.edit.not_yours") : t("job.admin.forbidden")) : state.error === "failed" ? t("common.error") : state.error}
        </p>
      )}
      {state?.ok && <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">{state.published ? t("job.edit.saved_published") : t("common.saved")}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" disabled={locked || pending}>{t("common.save")}</Button>
        {/* Saves, then opens the post to applicants (on a post that is already open it simply saves and keeps it open). */}
        {!locked && (
          <Button type="submit" name="publish" value="1" size="lg" variant="accent" disabled={pending}>{t("job.edit.save_publish")}</Button>
        )}
        <Link href={backHref ?? "/admin?tab=jobs"} className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-6 font-semibold">{mode === "owner" ? t("job.edit.back") : t("job.admin.back")}</Link>
      </div>
    </form>
  );
}
