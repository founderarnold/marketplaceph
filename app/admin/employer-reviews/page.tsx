import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { EmployerReviewForm } from "@/components/jobs2/employer-review-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { nowMs, timeAgo } from "@/lib/format";
import { isOn } from "@/lib/flags";
import { getT } from "@/lib/i18n/server";
import { isFullAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Employer review queue", robots: { index: false } };
const REVIEW_WITHIN_DAYS = 3;

type Review = { employer_id: string; decision: string; reason: string | null; created_at: string };

/**
 * Jobs 2.0 P6 review queue (flag jobs2_employer_pipeline; full admins only). Employers with open or draft posts and
 * no Credible Employer badge. Nothing is hidden or deleted: posts stay as they are, labelled, until a reviewer decides.
 */
async function Queue() {
  if (!isOn("jobs2_employer_pipeline")) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect("/login?next=/admin/employer-reviews");
  const { data: role } = await supabase.from("profiles").select("role").eq("id", me).single();
  if (!isFullAdmin(role?.role)) redirect("/admin");

  const { data: posts } = await supabase
    .from("job_posts")
    .select("id, owner_id, title, company_name, poster_type, agency_license_no, status, created_at")
    .in("status", ["active", "hidden"])
    .order("created_at")
    .limit(500);
  const owners = [...new Set((posts ?? []).map((p) => p.owner_id))];
  const [{ data: badges }, { data: reviews }] = await Promise.all([
    owners.length ? supabase.from("user_badges").select("user_id").eq("badge", "credible_employer").in("user_id", owners) : Promise.resolve({ data: [] as { user_id: string }[] }),
    owners.length
      ? (supabase as unknown as SupabaseClient).from("employer_reviews").select("employer_id, decision, reason, created_at").in("employer_id", owners).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Review[] }),
  ]);
  const verified = new Set((badges ?? []).map((b) => b.user_id));
  const latest = new Map<string, Review>();
  for (const r of (reviews ?? []) as Review[]) if (!latest.has(r.employer_id)) latest.set(r.employer_id, r);
  const now = nowMs();
  const queue = owners.filter((o) => !verified.has(o)).map((o) => ({ owner: o, posts: (posts ?? []).filter((p) => p.owner_id === o) }));

  return (
    <div className="space-y-4">
      <Link href="/admin?tab=jobs" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">← {t("job.admin.title")}</Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("job6.queue_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("job6.queue_hint", { n: REVIEW_WITHIN_DAYS })}</p>
      </header>
      {!queue.length && <p className="rounded-2xl bg-muted p-6 text-center text-muted-foreground">{t("job6.queue_empty")}</p>}
      <ul className="space-y-3">
        {queue.map(({ owner, posts: ps }) => {
          const since = ps[0].created_at;
          const due = new Date(new Date(since).getTime() + REVIEW_WITHIN_DAYS * 86_400_000);
          const overdue = due.getTime() < now;
          const last = latest.get(owner);
          const agency = ps.some((p) => p.poster_type === "agency");
          const licence = ps.find((p) => p.agency_license_no)?.agency_license_no;
          return (
            <li key={owner} className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 flex-1 basis-40 font-bold text-brand-dark">{ps[0].company_name}</h2>
                <Badge tone="neutral">{t("job5.review.unverified")}</Badge>
                {agency && <Badge tone="accent">{t("job.agency")}{licence ? ` · ${licence}` : ""}</Badge>}
                <Badge tone={overdue ? "danger" : "brand"}>{overdue ? t("job6.overdue") : t("job6.due", { when: due.toISOString().slice(0, 10) })}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("job6.waiting_since", { when: timeAgo(since) })}</p>
              <ul className="flex flex-wrap gap-2 text-sm">
                {ps.slice(0, 6).map((p) => (
                  <li key={p.id}><Link href={`/jobs/${p.id}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-3 underline">{p.title} · {t(`job.poststatus.${p.status}`)}</Link></li>
                ))}
              </ul>
              {last && <p className="rounded-xl bg-muted p-2 text-sm">{t("job6.last_review", { decision: t(`job6.decision.${last.decision}`), when: timeAgo(last.created_at) })}{last.reason ? ` — ${last.reason}` : ""}</p>}
              {last?.decision === "approved" && <Link href="/admin?tab=badges" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">{t("job6.grant_badge")}</Link>}
              <details>
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">{t("job6.record_review")}</summary>
                <EmployerReviewForm employerId={owner} isAgency={agency} />
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Queue />
    </Suspense>
  );
}
