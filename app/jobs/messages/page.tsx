import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Job messages" };

export default async function JobMessagesPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect("/login?next=/jobs/messages");

  const { data: threads } = await supabase
    .from("job_threads")
    .select("id, application_id, employer_id, applicant_id, last_message_at, job_applications ( post_id, job_posts ( title, company_name ) )")
    .order("last_message_at", { ascending: false })
    .limit(50);
  const ids = (threads ?? []).map((x) => x.id);
  const { data: recent } = ids.length
    ? await supabase.from("job_messages").select("thread_id, sender_id, body, created_at, read_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(300)
    : { data: [] };
  const applicantIds = [...new Set((threads ?? []).filter((x) => x.employer_id === me).map((x) => x.applicant_id))];
  const { data: names } = applicantIds.length ? await supabase.from("job_profiles").select("user_id, full_name").in("user_id", applicantIds) : { data: [] };
  const nm = new Map((names ?? []).map((n) => [n.user_id, n.full_name]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.msg.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("job.msg.intro")}</p>
      {!threads?.length ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("job.msg.none")}</p>
          <p className="text-sm text-muted-foreground">{t("job.msg.none_hint")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/jobs/applications" className={buttonClass("outline", "md")}>{t("job.nav.applications")}</Link>
            <Link href="/jobs/employer" className={buttonClass("outline", "md")}>{t("job.nav.employer")}</Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {threads.map((th) => {
            const msgs = (recent ?? []).filter((m) => m.thread_id === th.id);
            const last = msgs[0];
            const unread = msgs.filter((m) => m.sender_id !== me && !m.read_at).length;
            const post = th.job_applications?.job_posts;
            const who = th.employer_id === me ? (nm.get(th.applicant_id) ?? t("job.msg.applicant")) : (post?.company_name ?? t("job.msg.employer"));
            return (
              <li key={th.id}>
                <Link href={`/jobs/messages/${th.application_id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-brand-dark">{who}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(th.last_message_at)}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{post?.title}</span>
                    <span className={`block truncate text-sm ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{last?.body ?? t("job.msg.no_messages")}</span>
                  </span>
                  {unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-brand-dark">{unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
