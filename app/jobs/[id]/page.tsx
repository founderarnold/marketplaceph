import { Briefcase, CalendarClock, MapPin, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ApplyPanel } from "@/components/jobs/apply-panel";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { salaryLabel } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Job details" };

export default function JobPage(props: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Job params={props.params} />
    </Suspense>
  );
}

async function Job({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("job_posts")
    .select("*, psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )")
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const isOwner = userId === job.owner_id;
  const open = job.status === "active" && (!job.deadline || job.deadline >= new Date().toISOString().slice(0, 10));
  const pay = salaryLabel(job.salary_min, job.salary_max, job.salary_period, (p) => t(`job.per.${p}`));
  const where = job.work_setup === "remote" ? t("job.setup.remote") : [job.psgc_cities?.name, job.psgc_provinces?.name, job.psgc_regions?.short_name].filter(Boolean).join(", ");

  let application: { status: string; created_at: string } | null = null;
  let profileReady = false;
  let docs: { id: string; kind: string; title: string | null }[] = [];
  if (userId && !isOwner) {
    const [{ data: app }, { data: prof }, { data: d }] = await Promise.all([
      supabase.from("job_applications").select("status, created_at").eq("post_id", id).eq("applicant_id", userId).maybeSingle(),
      supabase.from("job_profiles").select("consent_at").eq("user_id", userId).maybeSingle(),
      supabase.from("job_documents").select("id, kind, title").eq("user_id", userId).order("created_at"),
    ]);
    application = app;
    profileReady = !!prof?.consent_at;
    docs = d ?? [];
  }

  return (
    <article className="grid gap-5 md:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {!open && <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{t("job.closed")}</p>}
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{job.title}</h1>
          <p className="text-lg font-semibold">
            {job.company_name}
            {job.poster_type === "agency" && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">{t("job.agency")}</span>}
          </p>
          {job.poster_type === "agency" && (
            <p className="text-sm text-muted-foreground">
              {t("job.license")}: <b>{job.agency_license_no}</b>
              {job.for_client && <> · {t("job.for_client")}</>}
            </p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1"><Briefcase size={15} aria-hidden /> {t(`job.type.${job.employment_type}`)} · {t(`job.setup.${job.work_setup}`)}</li>
            {where && <li className="flex items-center gap-1"><MapPin size={15} aria-hidden /> {where}</li>}
            <li className="flex items-center gap-1"><Users size={15} aria-hidden /> {t("job.vacancies_n", { n: job.vacancies })}</li>
            {job.deadline && <li className="flex items-center gap-1"><CalendarClock size={15} aria-hidden /> {t("job.deadline_on", { date: new Date(job.deadline).toLocaleDateString("en-PH", { dateStyle: "medium" }) })}</li>}
          </ul>
          {pay && <p className="inline-block rounded-xl bg-success-soft px-3 py-1.5 text-lg font-extrabold text-success">{pay}</p>}
          <p className="text-xs text-muted-foreground">{t("job.posted", { when: timeAgo(job.created_at) })} · {t(`job.cat.${job.category}`)}</p>
        </header>

        <section aria-labelledby="jd-desc">
          <h2 id="jd-desc" className="mb-1 font-bold text-brand-dark">{t("job.about_job")}</h2>
          <p className="whitespace-pre-line leading-relaxed">{job.description}</p>
        </section>
        {job.qualifications && (
          <section aria-labelledby="jd-qual">
            <h2 id="jd-qual" className="mb-1 font-bold text-brand-dark">{t("job.qualifications")}</h2>
            <p className="whitespace-pre-line leading-relaxed">{job.qualifications}</p>
          </section>
        )}
        {job.requirement_docs.length > 0 && (
          <section aria-labelledby="jd-docs">
            <h2 id="jd-docs" className="mb-1 font-bold text-brand-dark">{t("job.requirements")}</h2>
            <ul className="list-disc space-y-0.5 pl-5">{job.requirement_docs.map((k) => <li key={k}>{t(`job.doc.${k}`)}</li>)}</ul>
          </section>
        )}
        <aside className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>{t("job.safety")}</p>
        </aside>
      </div>

      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-white p-4 md:sticky md:top-24" aria-labelledby="apply-h">
        <h2 id="apply-h" className="text-lg font-bold text-brand-dark">{t("job.apply.title")}</h2>
        {isOwner ? (
          <Link href={`/jobs/employer/${job.id}`} className={buttonClass("primary", "md", "w-full")}>{t("job.emp.view_applicants")}</Link>
        ) : !open ? (
          <p className="text-sm text-muted-foreground">{t("job.closed")}</p>
        ) : !userId ? (
          <>
            <p className="text-sm text-muted-foreground">{t("job.apply.login")}</p>
            <Link href={`/login?next=/jobs/${job.id}`} className={buttonClass("accent", "lg", "w-full")}>{t("job.apply.login_btn")}</Link>
          </>
        ) : application ? (
          <div className="space-y-2">
            <p className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">✓ {t("job.apply.done", { status: t(`job.status.${application.status}`) })}</p>
            <Link href="/jobs/applications" className={buttonClass("outline", "md", "w-full")}>{t("job.nav.applications")}</Link>
          </div>
        ) : !profileReady ? (
          <>
            <p className="text-sm text-muted-foreground">{t("job.apply.need_profile")}</p>
            <Link href={`/jobs/profile?next=/jobs/${job.id}`} className={buttonClass("accent", "lg", "w-full")}>{t("job.apply.make_profile")}</Link>
          </>
        ) : (
          <ApplyPanel postId={job.id} docs={docs} requested={job.requirement_docs} />
        )}
      </aside>
    </article>
  );
}
