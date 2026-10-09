import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ChatThread } from "@/components/chat/chat-thread";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Job chat" };

export default function JobThreadPage(props: PageProps<"/jobs/messages/[appId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Thread params={props.params} />
    </Suspense>
  );
}

async function Thread({ params }: Pick<PageProps<"/jobs/messages/[appId]">, "params">) {
  const { appId } = await params;
  if (!z.uuid().safeParse(appId).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect(`/login?next=/jobs/messages/${appId}`);

  // Finds the thread for this application, or creates it. Only the applicant and the employer who owns the post can do this.
  const { data: threadId, error } = await supabase.rpc("open_job_thread", { p_app: appId });
  if (error || !threadId) notFound();

  const { data: app } = await supabase
    .from("job_applications")
    .select("id, status, applicant_id, job_posts ( id, title, company_name, owner_id )")
    .eq("id", appId)
    .maybeSingle();
  if (!app?.job_posts) notFound();
  const iAmEmployer = app.job_posts.owner_id === me;
  const { data: prof } = iAmEmployer ? await supabase.from("job_profiles").select("full_name").eq("user_id", app.applicant_id).maybeSingle() : { data: null };
  const title = iAmEmployer ? (prof?.full_name ?? t("job.msg.applicant")) : app.job_posts.company_name;

  const { data: msgs } = await supabase.from("job_messages").select("id, sender_id, body, created_at, read_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(200);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/jobs/messages" className="text-sm font-semibold text-brand hover:underline">← {t("job.nav.messages")}</Link>
        <h1 className="truncate text-lg font-bold text-brand-dark">{title}</h1>
        <Link href={iAmEmployer ? `/jobs/employer/${app.job_posts.id}` : `/jobs/${app.job_posts.id}`} className="ml-auto text-sm text-brand hover:underline">
          {iAmEmployer ? t("job.msg.view_applicants") : t("job.msg.view_job")}
        </Link>
      </div>
      <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{t("job.msg.about", { title: app.job_posts.title })}</p>
      {app.status === "withdrawn" ? (
        <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{t("job.msg.withdrawn")}</p>
      ) : (
        <ChatThread conversationId={threadId} me={me} initial={msgs ?? []} kind="job" />
      )}
      <p className="text-xs text-muted-foreground">{t("job.msg.safety")}</p>
    </div>
  );
}
