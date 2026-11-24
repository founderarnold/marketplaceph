import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PrintButton } from "@/components/jobs2/print-button";
import { buttonClass } from "@/components/ui/button";
import { isOn } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My resume", robots: { index: false } };

/**
 * ATS-friendly resume (flag jobs2_resume_builder): one column, plain headings, real text, no tables or images.
 * Built from the job profile on every visit and printed / saved as PDF by the browser; nothing is stored.
 * Never includes birthdate, sex, civil status, street address or clearances: those fields are not even read here.
 */
const RESUME_FIELDS = "full_name, headline, phone, contact_email, about, skills, education_level, experience_years, work_history, desired_roles, psgc_cities ( name ), psgc_provinces ( name )";

type ResumeRow = {
  full_name: string; headline: string | null; phone: string | null; contact_email: string | null; about: string | null; skills: string[];
  education_level: string | null; experience_years: number | null; desired_roles: string | null;
  work_history: { company?: string; role?: string; from?: string; to?: string; notes?: string }[];
  psgc_cities: { name: string } | null; psgc_provinces: { name: string } | null;
};

async function Resume({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isOn("jobs2_resume_builder")) notFound();
  const sp = await searchParams;
  const showContact = sp.contact !== "0";
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/profile/resume");
  const { data } = await supabase.from("job_profiles").select(RESUME_FIELDS).eq("user_id", userId).maybeSingle();
  const r = data as unknown as ResumeRow | null;
  const back = isOn("jobs2_profile_wizard") ? "/jobs/profile/wizard?step=4" : "/jobs/profile";
  if (!r) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 rounded-2xl bg-muted p-6 text-center">
        <p className="font-semibold">{t("job4.resume_empty")}</p>
        <Link href={back} className={buttonClass("primary", "lg")}>{t("job4.resume_fill")}</Link>
      </div>
    );
  }
  const where = [r.psgc_cities?.name, r.psgc_provinces?.name].filter(Boolean).join(", ");
  const contact = [showContact ? r.phone : null, showContact ? r.contact_email : null, where || null].filter(Boolean).join(" · ");
  const history = (r.work_history ?? []).filter((h) => h.company || h.role);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-2 print:hidden">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job4.resume_title")}</h1>
        <p className="text-muted-foreground">{t("job4.resume_sub")}</p>
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("job4.resume_privacy")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <PrintButton label={t("job4.resume_print")} />
          <Link href={showContact ? "?contact=0" : "?"} className={buttonClass("outline", "lg", "w-full sm:w-auto")}>{showContact ? t("job4.resume_hide_contact") : t("job4.resume_show_contact")}</Link>
          <Link href={back} className={buttonClass("ghost", "lg", "w-full sm:w-auto")}>{t("job4.resume_edit")}</Link>
        </div>
      </div>

      <article id="resume" className="space-y-4 break-words rounded-2xl border border-border bg-white p-5 font-sans text-[15px] leading-relaxed text-black sm:p-8">
        <header>
          <h2 className="text-2xl font-bold">{r.full_name}</h2>
          {r.headline && <p className="text-base">{r.headline}</p>}
          {contact && <p className="text-sm">{contact}</p>}
        </header>
        {r.about && (<section><h3 className="border-b border-black/30 text-sm font-bold uppercase tracking-wide">{t("job4.r.summary")}</h3><p className="mt-1 whitespace-pre-line">{r.about}</p></section>)}
        {r.skills?.length > 0 && (<section><h3 className="border-b border-black/30 text-sm font-bold uppercase tracking-wide">{t("job4.r.skills")}</h3><p className="mt-1">{r.skills.join(", ")}</p></section>)}
        {(history.length > 0 || r.experience_years != null) && (
          <section>
            <h3 className="border-b border-black/30 text-sm font-bold uppercase tracking-wide">{t("job4.r.experience")}</h3>
            {r.experience_years != null && <p className="mt-1">{t("job4.r.years", { n: r.experience_years })}</p>}
            <ul className="mt-1 space-y-2">
              {history.map((h, i) => (
                <li key={i}>
                  <p className="font-semibold">{[h.role, h.company].filter(Boolean).join(", ")}{(h.from || h.to) && ` (${[h.from, h.to].filter(Boolean).join(" – ")})`}</p>
                  {h.notes && <p>{h.notes}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {r.education_level && (<section><h3 className="border-b border-black/30 text-sm font-bold uppercase tracking-wide">{t("job4.r.education")}</h3><p className="mt-1">{t(`job.edu.${r.education_level}`)}</p></section>)}
        {r.desired_roles && (<section><h3 className="border-b border-black/30 text-sm font-bold uppercase tracking-wide">{t("job4.r.objective")}</h3><p className="mt-1">{r.desired_roles}</p></section>)}
      </article>
    </div>
  );
}

export default function Page(props: PageProps<"/jobs/profile/resume">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Resume searchParams={props.searchParams} />
    </Suspense>
  );
}
