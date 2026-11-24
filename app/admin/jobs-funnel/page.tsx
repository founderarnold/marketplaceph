import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { isOn } from "@/lib/flags";
import { nowMs } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { isFullAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Jobs funnel", robots: { index: false } };

/** Funnel order from the Jobs 2.0 plan (section 6 / Prompt 7). */
const FUNNEL = [
  "jobs_landing_view", "job_search", "job_view", "signup_start", "profile_step_complete", "profile_ready", "resume_generated",
  "apply_start", "apply_submitted", "employer_viewed", "status_changed", "interview", "hire_recorded", "hire_confirmed", "review_submitted",
] as const;
type Row = { day: string; name: string; source: string; chapter: string; events: number; sessions: number; members: number };

/**
 * Jobs 2.0 P7 funnel (full admins; needs jobs2_landing, which turns events on). Counts only: no names, emails,
 * phone numbers, search text or notes are stored. Sessions are random per-browser ids.
 */
async function Funnel({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isOn("jobs2_landing")) notFound();
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect("/login?next=/admin/jobs-funnel");
  const { data: role } = await supabase.from("profiles").select("role").eq("id", me).single();
  if (!isFullAdmin(role?.role)) redirect("/admin");

  const since = new Date(nowMs() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await (supabase as unknown as SupabaseClient).from("job_funnel_daily").select("*").gte("day", since).limit(5000);
  const rows = (data ?? []) as Row[];
  const total = (name: string, k: "events" | "sessions") => rows.filter((r) => r.name === name).reduce((n, r) => n + Number(r[k]), 0);
  const sources = new Map<string, { views: number; applied: number }>();
  for (const r of rows) {
    const key = r.chapter ? `${r.source} · ${r.chapter}` : r.source;
    const s = sources.get(key) ?? { views: 0, applied: 0 };
    if (r.name === "jobs_landing_view") s.views += Number(r.sessions);
    if (r.name === "apply_submitted") s.applied += Number(r.events);
    sources.set(key, s);
  }
  const top = total(FUNNEL[0], "sessions") || 1;

  return (
    <div className="space-y-4">
      <Link href="/admin?tab=jobs" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">← {t("job.admin.title")}</Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("job7.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("job7.hint")}</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label={t("job7.range")}>
        {[7, 30, 90].map((d) => (
          <Link key={d} href={`/admin/jobs-funnel?days=${d}`} aria-current={d === days ? "page" : undefined}
            className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${d === days ? "border-brand bg-brand text-white" : "border-border bg-white"}`}>{t("job7.days", { n: d })}</Link>
        ))}
      </nav>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{t("job7.not_ready")}</p>}
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[320px] text-sm">
          <caption className="sr-only">{t("job7.title")}</caption>
          <thead className="bg-muted text-left"><tr><th className="p-2">{t("job7.step")}</th><th className="p-2 text-right">{t("job7.sessions")}</th><th className="p-2 text-right">{t("job7.events")}</th></tr></thead>
          <tbody>
            {FUNNEL.map((name) => {
              const s = total(name, "sessions");
              return (
                <tr key={name} className="border-t border-border">
                  <th scope="row" className="p-2 text-left font-semibold">
                    {t(`job7.ev.${name}`)}
                    <span className="mt-1 block h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((s / top) * 100))}%` }} aria-hidden />
                  </th>
                  <td className="p-2 text-right tabular-nums">{s}</td>
                  <td className="p-2 text-right tabular-nums">{total(name, "events")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="space-y-2" aria-labelledby="src-h">
        <h2 id="src-h" className="font-bold text-brand-dark">{t("job7.by_source")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="bg-muted text-left"><tr><th className="p-2">{t("job7.source")}</th><th className="p-2 text-right">{t("job7.views")}</th><th className="p-2 text-right">{t("job7.applied")}</th></tr></thead>
            <tbody>
              {[...sources.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 50).map(([k, v]) => (
                <tr key={k} className="border-t border-border"><th scope="row" className="break-all p-2 text-left font-normal">{k}</th><td className="p-2 text-right tabular-nums">{v.views}</td><td className="p-2 text-right tabular-nums">{v.applied}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function Page(props: PageProps<"/admin/jobs-funnel">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Funnel searchParams={props.searchParams} />
    </Suspense>
  );
}
