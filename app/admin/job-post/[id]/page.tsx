import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PublishButton } from "@/components/jobs/employer-actions";
import { AdminJobPostForm, type AdminPost } from "@/components/jobs/admin-post-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { isFullAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit job post", robots: { index: false } };

async function EditJobPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/admin/job-post/${id}`)}`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", me).single();
  if (!isFullAdmin(profile?.role)) redirect("/admin?tab=jobs");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: post }, locations] = await Promise.all([
    supabase
      .from("job_posts")
      .select("id, company_name, title, category, description, qualifications, employment_type, work_setup, region_code, province_code, city_code, salary_min, salary_max, salary_period, vacancies, deadline, requirement_docs, status")
      .eq("id", id)
      .maybeSingle(),
    getLocations(),
  ]);
  if (!post) notFound();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="min-w-0 flex-1 text-2xl font-extrabold text-brand-dark">{t("job.admin.edit_title")}</h1>
        <Badge tone={post.status === "active" ? "success" : post.status === "removed" ? "danger" : "neutral"}>{t(`job.poststatus.${post.status}`)}</Badge>
        {(post.status === "hidden" || post.status === "active") && <PublishButton id={post.id} status={post.status} />}
      </header>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("job.admin.edit_hint")}</p>
      <AdminJobPostForm post={post as AdminPost} locations={locations} />
    </div>
  );
}

export default function Page(props: PageProps<"/admin/job-post/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditJobPost params={props.params} />
    </Suspense>
  );
}
