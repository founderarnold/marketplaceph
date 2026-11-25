import Link from "next/link";
import { MapPin } from "lucide-react";
import { ModerateButton, PublishAllDraftsButton, PublishButton } from "@/components/jobs/employer-actions";
import { DuplicateButton } from "@/components/jobs2/posting-tools";
import { HiringTags } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { hasAdminPlaceholder } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Admin → Jobs: newest posts first; moderators can remove a post (and restore it). Applicant data is never shown here.
 * Full admins can also edit hidden drafts (e.g. the starter posts) and publish or unpublish them.
 */
export async function JobsAdmin({ canEdit = false, show = "all" }: { canEdit?: boolean; show?: "all" | "drafts" }) {
  const { t } = await getT();
  const supabase = await createClient();
  let query = supabase
    .from("job_posts")
    .select("id, title, company_name, poster_type, agency_license_no, status, created_at, owner_id, description, qualifications, hiring_tags, work_setup, psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )")
    .order("created_at", { ascending: false })
    .limit(show === "drafts" ? 200 : 60);
  if (show === "drafts") query = query.eq("status", "hidden");
  const { data: posts } = await query;
  return (
    <section className="space-y-2" aria-labelledby="jobs-h">
      <h2 id="jobs-h" className="font-bold text-brand-dark">{t("job.admin.title")}</h2>
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("job.admin.hint")}</p>
      {canEdit && (
        <nav className="flex gap-1 rounded-xl bg-muted p-1 text-sm font-semibold" aria-label={t("job.admin.title")}>
          {(["all", "drafts"] as const).map((x) => (
            <Link key={x} href={`/admin?tab=jobs${x === "drafts" ? "&show=drafts" : ""}`} aria-current={show === x ? "page" : undefined}
              className={cn("inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-3", show === x ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}>
              {t(`job.admin.show_${x}`)}
            </Link>
          ))}
        </nav>
      )}
      {canEdit && show === "drafts" && (
        <PublishAllDraftsButton count={(posts ?? []).filter((p) => hasAdminPlaceholder(p.title, p.description, p.qualifications)).length} />
      )}
      {!posts?.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("admin.none")}</p>}
      <ul className="space-y-2">
        {posts?.map((p) => {
          const needsFill = p.status === "hidden" && hasAdminPlaceholder(p.title, p.description, p.qualifications);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 text-sm">
              <span className="min-w-0 flex-1 basis-56">
                <Link href={`/jobs/${p.id}`} className="font-semibold text-brand underline">{p.title}</Link>
                <span className="block text-xs text-muted-foreground">
                  {p.company_name} · {t(`job.poster.${p.poster_type}`)}{p.agency_license_no ? ` · ${p.agency_license_no}` : ""} · {timeAgo(p.created_at)}
                </span>
                {/* Where the job is: city and province (or region), so admins can see each post's deployment area at a glance. */}
                <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-brand-dark">
                  <MapPin size={13} className="shrink-0" aria-hidden />
                  {[p.psgc_cities?.name, p.psgc_provinces?.name ?? p.psgc_regions?.short_name].filter(Boolean).join(", ") || t("job.admin.no_location")}
                  {p.work_setup !== "onsite" && <> · {t(`job.setup.${p.work_setup}`)}</>}
                </span>
              </span>
              <Badge tone={p.status === "active" ? "success" : p.status === "removed" ? "danger" : "neutral"}>{t(`job.poststatus.${p.status}`)}</Badge>
              <HiringTags tags={p.hiring_tags} t={t} />
              {needsFill && <Badge tone="accent">{t("job.admin.needs_fill")}</Badge>}
              {canEdit && p.status !== "removed" && (
                <Link href={`/admin/job-post/${p.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 font-semibold">{t("job.admin.edit")}</Link>
              )}
              {canEdit && p.status !== "removed" && <DuplicateButton id={p.id} admin />}
              {canEdit && (p.status === "hidden" || p.status === "active") && <PublishButton id={p.id} status={p.status} />}
              <ModerateButton id={p.id} removed={p.status === "removed"} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
