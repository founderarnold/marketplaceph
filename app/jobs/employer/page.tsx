import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PostStatusButtons } from "@/components/jobs/employer-actions";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employer dashboard" };

export default async function EmployerDashboard() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/employer");

  const [{ data: posts }, { data: apps }] = await Promise.all([
    supabase.from("job_posts").select("id, title, company_name, status, vacancies, created_at, deadline").eq("owner_id", userId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("job_applications").select("post_id, status"),
  ]);
  const count = new Map<string, { total: number; fresh: number }>();
  for (const a of apps ?? []) {
    const c = count.get(a.post_id) ?? { total: 0, fresh: 0 };
    if (a.status !== "withdrawn") c.total++;
    if (a.status === "submitted") c.fresh++;
    count.set(a.post_id, c);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.emp.title")}</h1>
        <Link href="/jobs/post" className={buttonClass("accent", "md")}>{t("job.nav.post")}</Link>
      </div>
      {!posts?.length ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("job.emp.none")}</p>
          <Link href="/jobs/post" className={buttonClass("accent", "md")}>{t("job.nav.post")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const c = count.get(p.id) ?? { total: 0, fresh: 0 };
            return (
              <li key={p.id} className="space-y-2 rounded-2xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/jobs/employer/${p.id}`} className="font-bold text-brand-dark hover:underline">{p.title}</Link>
                    <p className="text-sm text-muted-foreground">{p.company_name} · {timeAgo(p.created_at)}</p>
                  </div>
                  <Badge tone={p.status === "active" ? "success" : "neutral"}>{t(`job.poststatus.${p.status}`)}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/jobs/employer/${p.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-soft px-3 font-semibold text-brand-dark">
                    <Users size={15} aria-hidden /> {t("job.emp.applicants_n", { n: c.total })}{c.fresh > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold text-brand-dark">{t("job.emp.new_n", { n: c.fresh })}</span>}
                  </Link>
                  <PostStatusButtons id={p.id} status={p.status} />
                  <Link href={`/jobs/${p.id}`} className="text-brand underline">{t("job.emp.preview")}</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
