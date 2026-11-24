import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import type { WizardStep } from "@/app/actions/jobs2";
import { DocumentsManager } from "@/components/jobs/documents-manager";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ProfileWizard, type WizardProfile } from "@/components/jobs2/profile-wizard";
import { getLocations } from "@/lib/data";
import { isOn } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Build my job profile", robots: { index: false } };

const FIELDS = "full_name, desired_roles, phone, contact_email, region_code, province_code, city_code, job_types, open_to_work, skills, education_level, experience_years, work_history, headline, about, consent_at";

async function Wizard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isOn("jobs2_profile_wizard")) notFound();
  const sp = await searchParams;
  const n = Number(Array.isArray(sp.step) ? sp.step[0] : sp.step);
  const step = ([1, 2, 3, 4, 5].includes(n) ? n : 1) as WizardStep;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/jobs/profile/wizard?step=${step}`)}`);
  const [{ data: profile }, { data: docs }, { data: me }, locations] = await Promise.all([
    supabase.from("job_profiles").select(FIELDS).eq("user_id", userId).maybeSingle(),
    supabase.from("job_documents").select("id, kind, title, mime_type, size_bytes, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    getLocations(),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job3.steps_title")}</h1>
        <p className="text-muted-foreground">{t("job4.sub")}</p>
      </header>
      <ProfileWizard step={step} profile={profile as unknown as WizardProfile | null} defaultName={me?.display_name ?? ""} locations={locations}
        resumeHref={isOn("jobs2_resume_builder") ? "/jobs/profile/resume" : null}
        documents={<DocumentsManager userId={userId} docs={docs ?? []} />} />
    </div>
  );
}

export default function Page(props: PageProps<"/jobs/profile/wizard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Wizard searchParams={props.searchParams} />
    </Suspense>
  );
}
