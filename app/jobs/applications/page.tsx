import { PageSkeleton } from "@/components/layout/page-skeleton";
import { HiringReviewForm } from "@/components/social/hiring-review-form";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, MessageCircle, MoveRight } from "lucide-react";
import { ConfirmHireButton, WithdrawButton } from "@/components/jobs/employer-actions";
import { FollowUpButton, ReapplyButton, ShareToFriend } from "@/components/jobs/companion-actions";
import { ApplicantTips } from "@/components/jobs/applicant-tips";
import { HiringTags, type JobCardData, JOB_CARD_SELECT } from "@/components/jobs/job-card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { timeAgo, todayPH } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AppTimeline } from "@/components/jobs2/app-timeline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOn } from "@/lib/flags";
import { applicationGuide, followUpFrom, reapplyState, type GuideApp } from "@/lib/jobs-companion";

export const metadata: Metadata = { title: "My applications" };

/** ISO date while it is still in the future, else null (the button is available now). */
const stillWaiting = (d: Date | null) => (d && d.getTime() > Date.now() ? d.toISOString() : null);

const tone = (s: string) => (s === "hired" || s === "shortlisted" || s === "interview" ? "success" : s === "rejected" || s === "withdrawn" ? "neutral" : "brand") as "success" | "neutral" | "brand";

type Post = { id: string; title: string; company_name: string; status: string; deadline: string | null };
type App = GuideApp & { id: string; employer_note: string | null; post_id: string; job_posts: Post | null };
type Msg = { thread_id: string; sender_id: string; body: string; created_at: string; read_at: string | null; is_system: boolean; system_kind: string | null };

async function MyApplicationsPageContent() {
  const { t } = await getT();
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient; // reapplied_at / reapply_count / saved_jobs are newer than the generated types
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/applications");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.marketplaceph.com";
  const today = todayPH();
  const isOpen = (p: Post | null) => !!p && p.status === "active" && (!p.deadline || p.deadline >= today);

  const [{ data: appsRaw }, { data: threads }, { data: resume }, { data: savedRows }, { data: profile }] = await Promise.all([
    db.from("job_applications")
      .select("id, post_id, status, created_at, updated_at, employer_note, applicant_confirmed_at, reapplied_at, reapply_count, job_posts ( id, title, company_name, status, deadline )")
      .eq("applicant_id", userId).order("created_at", { ascending: false }),
    supabase.from("job_threads").select("id, application_id").eq("applicant_id", userId).limit(200),
    supabase.from("job_documents").select("id").eq("user_id", userId).eq("kind", "resume").limit(1),
    db.from("saved_jobs").select("post_id").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("job_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  const apps = (appsRaw ?? []) as unknown as App[];
  const hasResume = !!resume?.length;

  // Messages per application: unread from the employer, the latest one, and the applicant's own last message.
  const threadOf = new Map((threads ?? []).map((th) => [th.application_id, th.id]));
  const threadIds = [...threadOf.values()];
  const { data: msgsRaw } = threadIds.length
    ? await supabase.from("job_messages").select("thread_id, sender_id, body, created_at, read_at, is_system, system_kind").in("thread_id", threadIds).order("created_at", { ascending: false }).limit(1000)
    : { data: [] };
  const msgs = (msgsRaw ?? []) as Msg[];
  const msgInfo = (appId: string) => {
    const tid = threadOf.get(appId);
    const mine = msgs.filter((m) => m.thread_id === tid);
    const fromEmployer = mine.filter((m) => m.sender_id !== userId);
    const own = mine.filter((m) => m.sender_id === userId && !m.is_system);
    return { unread: fromEmployer.filter((m) => !m.read_at).length, last: fromEmployer[0] ?? null, lastOwn: own[0]?.created_at ?? null };
  };

  const hiredIds = apps.filter((a) => a.status === "hired").map((a) => a.id);
  const { data: mineReviews } = hiredIds.length ? await supabase.from("job_reviews").select("application_id").eq("reviewer_id", userId).in("application_id", hiredIds) : { data: [] };
  const reviewed = new Set((mineReviews ?? []).map((r) => r.application_id));
  const timeline = isOn("jobs2_matching");

  const savedIds = ((savedRows ?? []) as { post_id: string }[]).map((r) => r.post_id);
  const { data: savedJobsRaw } = savedIds.length ? await supabase.from("job_posts").select(`${JOB_CARD_SELECT}, status, deadline`).in("id", savedIds) : { data: [] };
  const savedJobs = (savedJobsRaw ?? []) as unknown as (JobCardData & { status: string; deadline: string | null })[];
  const appByPost = new Map(apps.map((a) => [a.post_id, a]));
  const totalUnread = apps.reduce((n, a) => n + msgInfo(a.id).unread, 0);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.app.title")}</h1>
        <p className="text-muted-foreground">{t("comp.app.sub")}</p>
        {totalUnread > 0 && (
          <Link href="/jobs/messages" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-soft px-3 text-sm font-bold text-accent-strong">
            <MessageCircle size={16} aria-hidden /> {t("comp.msg.total", { n: totalUnread })}
          </Link>
        )}
        {!profile && (
          <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("comp.app.no_profile")} <Link href="/jobs/profile" className="font-semibold underline">{t("job.apply.make_profile")}</Link></p>
        )}
      </header>

      {!apps.length ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("job.app.none")}</p>
          <p className="text-sm text-muted-foreground">{t("comp.app.none_hint")}</p>
          <Link href="/jobs" className={buttonClass("accent", "md")}>{t("job.nav.find")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => {
            const post = a.job_posts;
            const m = msgInfo(a.id);
            const thread = `/jobs/messages/${a.id}`;
            const fu = followUpFrom(a, m.lastOwn);
            const ra = reapplyState(a, isOpen(post));
            const guide = applicationGuide(a, { hasResume, followedUp: !!m.lastOwn });
            const lastText = m.last ? (m.last.is_system && m.last.system_kind ? t(`sys.${m.last.system_kind}`) : m.last.body) : null;
            return (
              <li key={a.id} id={`app-${a.id}`} className="space-y-3 rounded-2xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      {post ? <Link href={`/jobs/${post.id}`} className="font-bold text-brand-dark hover:underline">{post.title}</Link> : <span className="font-bold">—</span>}
                      {m.unread > 0 && (
                        <Link href={thread} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-brand-dark" aria-label={t("comp.msg.new", { n: m.unread })}>
                          <MessageCircle size={13} aria-hidden /> {t("comp.msg.new", { n: m.unread })}
                        </Link>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {post?.company_name} · {t("job.app.applied", { when: timeAgo(a.created_at) })}
                      {a.reapplied_at && <> · {t("comp.reapply.when", { when: timeAgo(a.reapplied_at) })}</>}
                    </p>
                  </div>
                  <Badge tone={tone(a.status)}>{t(`job.status.${a.status}`)}</Badge>
                </div>
                <p className="rounded-xl bg-brand-soft p-2 text-sm text-brand-dark"><b>{t("comp.app.status_means")}</b> {t(`job5.next.${a.status}`)}</p>
                {timeline && <AppTimeline status={a.status} updatedAt={a.updated_at} t={t} />}
                {a.employer_note && <p className="rounded-xl bg-muted p-2 text-sm"><b>{t("job.app.employer_says")}</b> {a.employer_note}</p>}

                {m.last && (
                  <div className={`rounded-xl border p-2 text-sm ${m.unread ? "border-accent bg-accent-soft" : "border-border bg-muted"}`}>
                    <p className="text-xs font-semibold text-muted-foreground">{t("comp.msg.latest", { who: post?.company_name ?? t("job.msg.employer"), when: timeAgo(m.last.created_at) })}</p>
                    <p className="line-clamp-2">{lastText}</p>
                  </div>
                )}

                <details className="group rounded-xl border border-border p-2" open={!["hired", "withdrawn", "rejected"].includes(a.status)}>
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-brand-dark">{t("comp.guide.title")}</summary>
                  <ol className="space-y-2 pt-1">
                    {guide.map((s, i) => (
                      <li key={s.key} className="flex items-start gap-2 text-sm">
                        {s.state === "done" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-label={t("comp.guide.done")} />
                          : s.state === "now" ? <MoveRight size={18} className="mt-0.5 shrink-0 text-accent-strong" aria-label={t("comp.guide.now")} />
                          : <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-label={t("comp.guide.todo")} />}
                        <span>
                          <b className={s.state === "now" ? "text-accent-strong" : undefined}>{i + 1}. {t(`comp.guide.${s.key}`)}</b>
                          {s.state !== "done" && <span className="block text-muted-foreground">{t(`comp.guide.${s.key}_how`)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>

                <div className="flex flex-wrap items-center gap-2">
                  {a.status !== "withdrawn" && (
                    <Link href={thread} className={buttonClass(m.unread ? "accent" : "outline", "md", "min-h-11 gap-1.5")}>
                      <MessageCircle size={16} aria-hidden /> {m.unread ? t("comp.msg.read_reply") : t("job.msg.message_employer")}
                    </Link>
                  )}
                  {fu && post && <FollowUpButton appId={a.id} title={post.title} company={post.company_name} from={stillWaiting(fu)} threadHref={thread} />}
                  {ra.ok ? <ReapplyButton appId={a.id} from={null} />
                    : ra.from ? <ReapplyButton appId={a.id} from={ra.from.toISOString()} />
                    : (a.status === "withdrawn" || a.status === "rejected") && <span className="text-sm text-muted-foreground">{t(ra.reason === "max" ? "comp.reapply.max" : "comp.reapply.closed")}</span>}
                  {post && <ShareToFriend url={`${site}/jobs/${post.id}`} title={`${post.title} · ${post.company_name}`} />}
                  {a.status !== "withdrawn" && a.status !== "hired" && <WithdrawButton id={a.id} />}
                </div>
                {a.status === "hired" && !a.applicant_confirmed_at && <ConfirmHireButton id={a.id} />}
                {a.status === "hired" && a.applicant_confirmed_at && <p className="text-sm font-semibold text-success">✓ {t("job.confirm.done")}</p>}
                {a.status === "hired" && (reviewed.has(a.id) ? <p className="text-sm font-semibold text-success">✓ {t("rate.done")}</p> : <HiringReviewForm applicationId={a.id} about="employer" />)}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="saved-h" className="space-y-2">
        <h2 id="saved-h" className="text-xl font-bold text-brand-dark">{t("job.tools.saved_jobs")}</h2>
        {savedJobs.length ? (
          <ul className="space-y-3">
            {savedJobs.map((j) => {
              const a = appByPost.get(j.id);
              const open = j.status === "active" && (!j.deadline || j.deadline >= today);
              return (
                <li key={j.id} className="space-y-2 rounded-2xl border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/jobs/${j.id}`} className="font-bold text-brand-dark hover:underline">{j.title}</Link>
                      <p className="text-sm text-muted-foreground">{j.company_name} · {t(`job.type.${j.employment_type}`)} · {t(`job.setup.${j.work_setup}`)}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5"><HiringTags tags={j.hiring_tags} t={t} /></p>
                    </div>
                    {a ? <Badge tone={tone(a.status)}>{t(`job.status.${a.status}`)}</Badge> : <Badge tone="neutral">{open ? t("comp.saved.not_applied") : t("comp.saved.closed")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a ? t("comp.saved.applied_note") : open ? t("comp.saved.apply_note") : t("comp.saved.closed_note")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {a ? <a href={`#app-${a.id}`} className={buttonClass("outline", "md", "min-h-11")}>{t("comp.saved.see_app")}</a>
                      : open && <Link href={`/jobs/${j.id}#apply`} className={buttonClass("accent", "md", "min-h-11")}>{t("comp.btn.apply")}</Link>}
                    <ShareToFriend url={`${site}/jobs/${j.id}`} title={`${j.title} · ${j.company_name}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{t("job.tools.no_saved")}</p>}
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("comp.saved.buttons_note")}</p>
      </section>

      <ApplicantTips t={t} buttons />
    </div>
  );
}

export default function MyApplicationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyApplicationsPageContent />
    </Suspense>
  );
}
