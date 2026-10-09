import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WithdrawButton } from "@/components/jobs/employer-actions";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My applications" };

const tone = (s: string) => (s === "hired" || s === "shortlisted" || s === "interview" ? "success" : s === "rejected" || s === "withdrawn" ? "neutral" : "brand") as "success" | "neutral" | "brand";

export default async function MyApplicationsPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/applications");
  const { data: apps } = await supabase
    .from("job_applications")
    .select("id, status, created_at, employer_note, job_posts ( id, title, company_name, status )")
    .eq("applicant_id", userId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.app.title")}</h1>
      {!apps?.length ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("job.app.none")}</p>
          <Link href="/jobs" className={buttonClass("accent", "md")}>{t("job.nav.find")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => (
            <li key={a.id} className="space-y-1 rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  {a.job_posts ? <Link href={`/jobs/${a.job_posts.id}`} className="font-bold text-brand-dark hover:underline">{a.job_posts.title}</Link> : <span className="font-bold">—</span>}
                  <p className="text-sm text-muted-foreground">{a.job_posts?.company_name} · {t("job.app.applied", { when: timeAgo(a.created_at) })}</p>
                </div>
                <Badge tone={tone(a.status)}>{t(`job.status.${a.status}`)}</Badge>
              </div>
              {a.employer_note && <p className="rounded-xl bg-muted p-2 text-sm"><b>{t("job.app.employer_says")}</b> {a.employer_note}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {a.status !== "withdrawn" && <Link href={`/jobs/messages/${a.id}`} className={buttonClass("outline", "sm", "gap-1.5")}>{t("job.msg.message_employer")}</Link>}
                {a.status !== "withdrawn" && a.status !== "hired" && <WithdrawButton id={a.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
