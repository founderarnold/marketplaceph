import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { AdminJobPostForm, type AdminPost } from "@/components/jobs/admin-post-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit job post", robots: { index: false } };

/** Employers / manpower agencies edit their own job post (published or hidden). Applications stay attached. */
async function EditMyPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/jobs/employer/${id}/edit`)}`);
  const [{ data: post }, locations] = await Promise.all([
    supabase
      .from("job_posts")
      .select("id, owner_id, poster_type, agency_license_no, company_name, title, category, description, qualifications, employment_type, work_setup, region_code, province_code, city_code, salary_min, salary_max, salary_period, vacancies, deadline, requirement_docs, status")
      .eq("id", id)
      .maybeSingle(),
    getLocations(),
  ]);
  if (!post || post.owner_id !== me) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/jobs/employer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">← {t("job.emp.title")}</Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.edit.title")}</h1>
        <Badge tone={post.status === "active" ? "success" : post.status === "removed" ? "danger" : "neutral"}>{t(`job.poststatus.${post.status}`)}</Badge>
      </header>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("job.edit.hint")}</p>
      <AdminJobPostForm post={post as AdminPost} locations={locations} mode="owner" backHref="/jobs/employer" />
    </div>
  );
}

export default function Page(props: PageProps<"/jobs/employer/[id]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditMyPost params={props.params} />
    </Suspense>
  );
}
