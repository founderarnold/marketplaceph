"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { saveProfileStep, type StepResult, type WizardStep } from "@/app/actions/jobs2";
import { LocationSelect } from "@/components/listing/location-select";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, splitList } from "@/lib/jobs";

export type WizardProfile = {
  full_name: string; desired_roles: string | null; phone: string | null; contact_email: string | null;
  region_code: string | null; province_code: string | null; city_code: string | null; job_types: string[]; open_to_work: boolean;
  skills: string[]; education_level: string | null; experience_years: number | null;
  work_history: { company?: string; role?: string; from?: string; to?: string; notes?: string }[];
  headline: string | null; about: string | null; consent_at: string | null;
};

type Status = "idle" | "saving" | "saved" | "error" | "needs_tick";
const card = "space-y-3 rounded-2xl border border-border bg-white p-4";

/** Five-step, resumable job profile. Each step autosaves (1.2 s after typing stops, and when moving on). */
export function ProfileWizard({ step: initial, profile, defaultName, locations, resumeHref, documents }: {
  step: WizardStep; profile: WizardProfile | null; defaultName: string; locations: Locations; resumeHref: string | null; documents: React.ReactNode;
}) {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<StepResult["error"]>();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const collect = useCallback((): Record<string, unknown> => {
    const fd = new FormData(formRef.current!);
    const s = (k: string) => String(fd.get(k) ?? "");
    switch (step) {
      case 1: return { full_name: s("full_name"), desired_roles: s("desired_roles"), phone: s("phone"), contact_email: s("contact_email"), region_code: s("region_code"), province_code: s("province_code"), city_code: s("city_code"), job_types: fd.getAll("job_types").map(String), open_to_work: fd.get("open_to_work") === "on" };
      case 2: return { skills: splitList(s("skills")), education_level: s("education_level") || null };
      case 3: return { experience_years: s("experience_years"), work_history: [0, 1, 2].map((i) => ({ company: s(`wh_company_${i}`), role: s(`wh_role_${i}`), from: s(`wh_from_${i}`), to: s(`wh_to_${i}`), notes: s(`wh_notes_${i}`) })) };
      case 4: return { headline: s("headline"), about: s("about"), accurate: fd.get("accurate") === "on" };
      case 5: return { consent: fd.get("consent") === "on" };
    }
  }, [step]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!formRef.current) return true;
    if (timer.current) clearTimeout(timer.current);
    const data = collect();
    if (step === 4 && data.accurate !== true) { setStatus("needs_tick"); return false; }
    setStatus("saving");
    try {
      const res = await saveProfileStep(step, data);
      if (res.ok) { dirty.current = false; setStatus("saved"); setError(undefined); return true; }
      setStatus("error"); setError(res.error); return false;
    } catch {
      setStatus("error"); setError("failed"); return false; // offline or server unreachable: typing stays on screen
    }
  }, [collect, step]);

  const onChange = () => {
    dirty.current = true;
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, 1200);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = async (to: WizardStep) => {
    if (dirty.current && !(await save()) && step !== 4) return; // step 4 may be left unsaved until the box is ticked
    setStep(to);
    setStatus("idle");
    window.history.replaceState(null, "", `?step=${to}`);
    window.scrollTo({ top: 0 });
  };

  const p = profile;
  const history = p?.work_history ?? [];
  const statusText = status === "saving" ? t("job4.saving") : status === "saved" ? t("job4.saved") : status === "needs_tick" ? t("job4.need_accurate")
    : status === "error" ? (error === "invalid" ? t("job4.invalid") : error === "consent" ? t("job4.need_consent") : t("job4.save_failed")) : "";

  return (
    <div className="space-y-4">
      <nav aria-label={t("job3.steps_title")}>
        <ol className="grid grid-cols-5 gap-1">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <li key={n}>
              <button type="button" onClick={() => go(n)} aria-current={step === n ? "step" : undefined}
                className={`flex min-h-11 w-full flex-col items-center justify-center rounded-xl px-1 text-xs font-semibold ${step === n ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>
                <span className="text-base">{n}</span>
                <span className="sr-only">{t(`job3.step.${["goal", "skills", "experience", "summary", "privacy"][n - 1]}`)}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <form ref={formRef} key={step} onChange={onChange} onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4" noValidate>
        <h2 className="text-xl font-extrabold text-brand-dark">{t("job4.step_of", { n: step })} · {t(`job3.step.${["goal", "skills", "experience", "summary", "privacy"][step - 1]}`)}</h2>
        <aside className="flex gap-2 rounded-xl bg-accent-soft p-3 text-sm text-brand-dark">
          <Lightbulb size={18} className="mt-0.5 shrink-0" aria-hidden />
          <span><b className="block">{t(`job4.lesson${step}.title`)}</b>{t(`job4.lesson${step}.body`)}</span>
        </aside>

        {step === 1 && (
          <section className={card}>
            <Field label={t("job.pf.full_name")}><Input name="full_name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={p?.full_name ?? defaultName} /></Field>
            <Field label={t("job.pf.desired")} hint={t("job.pf.desired_hint")}><Input name="desired_roles" maxLength={200} defaultValue={p?.desired_roles ?? ""} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("job.pf.phone")}><Input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} defaultValue={p?.phone ?? ""} /></Field>
              <Field label={t("job.pf.email")}><Input name="contact_email" type="email" autoComplete="email" maxLength={120} defaultValue={p?.contact_email ?? ""} /></Field>
            </div>
            <p className="text-sm font-semibold text-brand-dark">{t("job.pf.where")}</p>
            <LocationSelect locations={locations} defaultValue={{ region: p?.region_code ?? undefined, province: p?.province_code ?? undefined, city: p?.city_code ?? undefined }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
            <fieldset>
              <legend className="mb-1 text-sm font-semibold">{t("job.pf.types")} <span className="font-normal text-muted-foreground">({t("job4.optional")})</span></legend>
              <div className="flex flex-wrap gap-2">
                {EMPLOYMENT_TYPES.map((o) => (
                  <label key={o} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm">
                    <input type="checkbox" name="job_types" value={o} defaultChecked={(p?.job_types ?? []).includes(o)} className="h-5 w-5 accent-[var(--brand)]" /> {t(`job.type.${o}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-start gap-3 rounded-xl bg-success-soft p-3 text-sm">
              <input type="checkbox" name="open_to_work" defaultChecked={p?.open_to_work ?? true} className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
              <span><b>{t("job.pf.open")}</b> {t("job.pf.open_hint")}</span>
            </label>
          </section>
        )}

        {step === 2 && (
          <section className={card}>
            <Field label={t("job.pf.skills")} hint={t("job4.skills_hint")}><Textarea name="skills" rows={3} maxLength={800} placeholder={t("job.pf.skills_ph")} defaultValue={(p?.skills ?? []).join(", ")} /></Field>
            <Field label={`${t("job.pf.education")} (${t("job4.optional")})`}>
              <Select name="education_level" defaultValue={p?.education_level ?? ""}>
                <option value="">—</option>
                {EDUCATION_LEVELS.map((o) => <option key={o} value={o}>{t(`job.edu.${o}`)}</option>)}
              </Select>
            </Field>
          </section>
        )}

        {step === 3 && (
          <section className={card}>
            <Field label={t("job.pf.experience")} hint={t("job.pf.experience_hint")}><Input name="experience_years" type="number" inputMode="numeric" min={0} max={60} defaultValue={p?.experience_years ?? ""} /></Field>
            <p className="text-sm text-muted-foreground">{t("job4.history_hint")}</p>
            {[0, 1, 2].map((i) => (
              <fieldset key={i} className="grid gap-2 rounded-xl bg-muted p-3 sm:grid-cols-2">
                <legend className="px-1 text-xs font-semibold text-muted-foreground">{t("job.pf.history_n", { n: i + 1 })} ({t("job4.optional")})</legend>
                <Input name={`wh_company_${i}`} maxLength={80} aria-label={t("job4.company_or_project")} placeholder={t("job4.company_or_project")} defaultValue={history[i]?.company ?? ""} />
                <Input name={`wh_role_${i}`} maxLength={80} aria-label={t("job.pf.role")} placeholder={t("job.pf.role")} defaultValue={history[i]?.role ?? ""} />
                <Input name={`wh_from_${i}`} maxLength={10} aria-label={t("job.pf.from")} placeholder={t("job.pf.from")} defaultValue={history[i]?.from ?? ""} />
                <Input name={`wh_to_${i}`} maxLength={10} aria-label={t("job.pf.to")} placeholder={t("job.pf.to")} defaultValue={history[i]?.to ?? ""} />
                <Input name={`wh_notes_${i}`} maxLength={300} className="sm:col-span-2" aria-label={t("job.pf.notes")} placeholder={t("job.pf.notes")} defaultValue={history[i]?.notes ?? ""} />
              </fieldset>
            ))}
          </section>
        )}

        {step === 4 && <SummaryStep headline={p?.headline ?? ""} about={p?.about ?? ""} onInsert={onChange} />}

        {step === 5 && (
          <section className="space-y-3">
            <div className="space-y-3 rounded-2xl border-2 border-accent/60 bg-accent-soft p-4">
              <p className="text-sm">{t("job.pf.privacy_body")}</p>
              <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
                <input type="checkbox" name="consent" defaultChecked={!!p?.consent_at} className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
                <span>{t("job.pf.consent")}</span>
              </label>
            </div>
            {resumeHref && <Link href={resumeHref} className={buttonClass("outline", "md", "w-full")}>{t("job4.make_resume")}</Link>}
          </section>
        )}

        <p role="status" aria-live="polite" className={`min-h-5 text-sm ${status === "error" || status === "needs_tick" ? "text-danger" : "text-muted-foreground"}`}>{statusText}</p>
        {status === "error" && <Button type="submit" variant="outline">{t("job4.retry")}</Button>}

        <div className="grid grid-cols-2 gap-2">
          {step > 1 ? <Button type="button" variant="outline" size="lg" onClick={() => go((step - 1) as WizardStep)}>{t("job4.back")}</Button> : <span />}
          {step < 5
            ? <Button type="button" size="lg" onClick={() => go((step + 1) as WizardStep)}>{t("job4.next")}</Button>
            : <Button type="button" size="lg" onClick={async () => { if (await save()) router.push("/jobs/start"); }}>{t("job4.finish")}</Button>}
        </div>
        {step > 1 && step < 5 && <p className="text-center text-xs text-muted-foreground">{t("job4.skip_ok")}</p>}
      </form>

      {step === 5 && documents}
      <p className="text-center text-sm"><Link href="/jobs/profile?full=1" className="text-brand underline">{t("job4.full_form")}</Link></p>
    </div>
  );
}

/** Step 4: headline and summary. Example text is clearly marked and the member must confirm their profile is true. */
function SummaryStep({ headline, about, onInsert }: { headline: string; about: string; onInsert: () => void }) {
  const { t } = useT();
  const use = (h: string, a: string) => {
    const head = document.getElementById("wz-headline") as HTMLInputElement | null;
    const box = document.getElementById("wz-about") as HTMLTextAreaElement | null;
    if (head && !head.value) head.value = h;
    if (box) box.value = box.value ? `${box.value}\n${a}` : a;
    onInsert();
  };
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
      <Field label={t("job.pf.headline")} hint={t("job.pf.headline_hint")}><Input id="wz-headline" name="headline" maxLength={100} placeholder={t("job.pf.headline_ph")} defaultValue={headline} /></Field>
      <Field label={t("job.pf.about")} hint={t("job4.about_hint")}><Textarea id="wz-about" name="about" maxLength={1500} rows={6} defaultValue={about} /></Field>
      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
        <p className="text-sm font-semibold">{t("job4.examples")}</p>
        {[1, 2].map((n) => (
          <div key={n} className="space-y-1 rounded-lg bg-muted p-2 text-sm">
            <p><span className="rounded bg-white px-1.5 text-xs font-bold uppercase text-accent-strong">{t("job4.example_label")}</span> {t(`job4.example${n}.about`)}</p>
            <Button type="button" size="md" variant="ghost" onClick={() => use(t(`job4.example${n}.headline`), t(`job4.example${n}.about`))}>{t("job4.use_example")}</Button>
          </div>
        ))}
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand-dark">
        <input type="checkbox" name="accurate" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
        <span>{t("job4.accurate")}</span>
      </label>
    </section>
  );
}
