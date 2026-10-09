import Link from "next/link";
import { ModerateButton } from "@/components/jobs/employer-actions";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/** Admin → Jobs: newest posts first; moderators can remove a post (and restore it). Applicant data is never shown here. */
export async function JobsAdmin() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("job_posts")
    .select("id, title, company_name, poster_type, agency_license_no, status, created_at, owner_id")
    .order("created_at", { ascending: false })
    .limit(60);
  return (
    <section className="space-y-2" aria-labelledby="jobs-h">
      <h2 id="jobs-h" className="font-bold text-brand-dark">{t("job.admin.title")}</h2>
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("job.admin.hint")}</p>
      {!posts?.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("admin.none")}</p>}
      <ul className="space-y-2">
        {posts?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-white p-3 text-sm">
            <span className="min-w-0 flex-1">
              <Link href={`/jobs/${p.id}`} className="font-semibold text-brand underline">{p.title}</Link>
              <span className="block text-xs text-muted-foreground">
                {p.company_name} · {t(`job.poster.${p.poster_type}`)}{p.agency_license_no ? ` · ${p.agency_license_no}` : ""} · {timeAgo(p.created_at)}
              </span>
            </span>
            <Badge tone={p.status === "active" ? "success" : p.status === "removed" ? "danger" : "neutral"}>{t(`job.poststatus.${p.status}`)}</Badge>
            <ModerateButton id={p.id} removed={p.status === "removed"} />
          </li>
        ))}
      </ul>
    </section>
  );
}
