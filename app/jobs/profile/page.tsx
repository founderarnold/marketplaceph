import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DocumentsManager } from "@/components/jobs/documents-manager";
import { JobProfileForm, type JobProfile } from "@/components/jobs/profile-form";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My job profile" };

export default async function JobProfilePage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/profile");

  const [{ data: profile }, { data: docs }, { data: me }, locations] = await Promise.all([
    supabase.from("job_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("job_documents").select("id, kind, title, mime_type, size_bytes, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    getLocations(),
  ]);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.pf.title")}</h1>
        <p className="text-muted-foreground">{t("job.pf.sub")}</p>
        {!profile && <p className="rounded-xl bg-accent-soft p-3 text-sm font-semibold text-accent-strong">{t("job.pf.start")}</p>}
      </header>
      <JobProfileForm profile={profile as JobProfile | null} locations={locations} defaultName={me?.display_name ?? ""} />
      <DocumentsManager userId={userId} docs={docs ?? []} />
    </div>
  );
}
