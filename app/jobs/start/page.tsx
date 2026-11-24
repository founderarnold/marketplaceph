import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buttonClass } from "@/components/ui/button";
import { ssoEnabled } from "@/lib/flame-sso";
import { isOn } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { READINESS_FIELDS, readiness } from "@/lib/jobs-readiness";
import { createClient } from "@/lib/supabase/server";
import { JobsTracker } from "@/components/jobs2/tracker";

export const metadata: Metadata = { title: "Start your job search", robots: { index: false } };

/**
 * Jobs 2.0 P3 onboarding shell (flag jobs2_sso_link). Signed out: honest account choices (FLAME PH sign-in is offered
 * only when it is switched on; it never changes how sign-in works). Signed in: five resumable steps derived from the
 * saved job profile, with the next missing step first.
 */
async function Start() {
  if (!isOn("jobs2_sso_link")) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  const back = encodeURIComponent("/jobs/start");

  if (!userId) {
    const flame = ssoEnabled();
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job3.title")}</h1>
          <p className="text-muted-foreground">{t("job3.sub")}</p>
        </header>
        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <Link href={`/login?mode=signup&next=${back}`} className={buttonClass("primary", "lg", "w-full")}>{t("job3.create")}</Link>
          <Link href={`/login?next=${back}`} className={buttonClass("outline", "lg", "w-full")}>{t("job3.signin")}</Link>
          <p className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden /> {flame ? t("job3.flame_on") : t("job3.flame_off")}
          </p>
          <p className="text-xs text-muted-foreground">{t("job3.free_only")}</p>
        </div>
      </div>
    );
  }

  const [{ data: profile }, { data: docs }] = await Promise.all([
    supabase.from("job_profiles").select(READINESS_FIELDS.join(", ")).eq("user_id", userId).maybeSingle(),
    supabase.from("job_documents").select("kind").eq("user_id", userId),
  ]);
  const r = readiness(profile as Parameters<typeof readiness>[0], docs ?? []);
  const wizard = isOn("jobs2_profile_wizard");
  const stepHref = (n: number) => (wizard ? `/jobs/profile/wizard?step=${n}` : "/jobs/profile");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job3.steps_title")}</h1>
        <p className="text-muted-foreground">{t("job3.progress", { n: r.done })}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={r.done} aria-label={t("job3.progress", { n: r.done })}>
          <div className="h-full bg-brand" style={{ width: `${(r.done / 5) * 100}%` }} />
        </div>
      </header>
      <ol className="space-y-2">
        {r.steps.map((s) => (
          <li key={s.key}>
            <Link href={stepHref(s.n)} className="flex min-h-14 items-start gap-3 rounded-2xl border border-border bg-white p-3 hover:bg-muted">
              {s.done ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={22} aria-hidden /> : <Circle className="mt-0.5 shrink-0 text-muted-foreground" size={22} aria-hidden />}
              <span className="min-w-0">
                <b className="block">{s.n}. {t(`job3.step.${s.key}`)}</b>
                <span className="sr-only">{s.done ? t("job3.done") : t("job3.todo")}</span>
                {s.missing.map((m) => <span key={m} className="block text-sm text-muted-foreground">{t(`job3.miss.${m}`)}</span>)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {r.done === 5 && <JobsTracker name="profile_ready" />}
      {r.next ? (
        <Link href={stepHref(r.next.n)} className={buttonClass("primary", "lg", "w-full")}>{t("job3.continue", { n: r.next.n })}</Link>
      ) : (
        <Link href="/jobs" className={buttonClass("primary", "lg", "w-full")}>{t("job3.ready")}</Link>
      )}
      <p className="text-xs text-muted-foreground">{t("job3.private")}</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Start />
    </Suspense>
  );
}
