import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JOB_CARD_SELECT, JobCard, type JobCardData } from "@/components/jobs/job-card";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { getT } from "@/lib/i18n/server";
import { EMPLOYMENT_TYPES, JOB_CATEGORIES, WORK_SETUPS } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Jobs",
  description: "Find jobs near you or hire the right people. Free for job seekers and employers on MarketplacePH.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE = 20;

export default async function JobsPage({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams;
  const { t } = await getT();
  const q = first(sp.q).trim().slice(0, 80);
  const category = (JOB_CATEGORIES as readonly string[]).includes(first(sp.category)) ? first(sp.category) : "";
  const type = (EMPLOYMENT_TYPES as readonly string[]).includes(first(sp.type)) ? first(sp.type) : "";
  const setup = (WORK_SETUPS as readonly string[]).includes(first(sp.setup)) ? first(sp.setup) : "";
  const page = Math.max(1, Math.min(50, Number(first(sp.page)) || 1));

  const supabase = await createClient();
  let query = supabase
    .from("job_posts")
    .select(JOB_CARD_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(`deadline.is.null,deadline.gte.${new Date().toISOString().slice(0, 10)}`)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, " ")}%,company_name.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  if (category) query = query.eq("category", category);
  if (type) query = query.eq("employment_type", type);
  if (setup) query = query.eq("work_setup", setup);
  const { data, count } = await query.overrideTypes<JobCardData[], { merge: false }>();
  const jobs = data ?? [];
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (n: number) => `/jobs?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(type && { type }), ...(setup && { setup }), page: String(n) })}`;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.title")}</h1>
        <p className="text-muted-foreground">{t("job.sub")}</p>
      </header>

      <form action="/jobs" className="space-y-2 rounded-2xl border border-border bg-white p-3" role="search">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder={t("job.search_ph")} aria-label={t("job.search_ph")} className="pl-10" />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Select name="category" defaultValue={category} aria-label={t("job.post.category")}>
            <option value="">{t("job.any_category")}</option>
            {JOB_CATEGORIES.map((o) => <option key={o} value={o}>{t(`job.cat.${o}`)}</option>)}
          </Select>
          <Select name="type" defaultValue={type} aria-label={t("job.post.etype")}>
            <option value="">{t("job.any_type")}</option>
            {EMPLOYMENT_TYPES.map((o) => <option key={o} value={o}>{t(`job.type.${o}`)}</option>)}
          </Select>
          <Select name="setup" defaultValue={setup} aria-label={t("job.post.setup")}>
            <option value="">{t("job.any_setup")}</option>
            {WORK_SETUPS.map((o) => <option key={o} value={o}>{t(`job.setup.${o}`)}</option>)}
          </Select>
          <button className={buttonClass("primary", "md", "w-full")}>{t("job.search")}</button>
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">{t("job.results", { n: count ?? 0 })}</p>

      {jobs.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="font-semibold">{t("job.none")}</p>
          <p className="text-sm text-muted-foreground">{t("job.none_hint")}</p>
          <Link href="/jobs/post" className={buttonClass("accent", "md")}>{t("job.nav.post")}</Link>
        </div>
      ) : (
        <ul className="space-y-3">{jobs.map((j) => <JobCard key={j.id} job={j} t={t} />)}</ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3">
          {page > 1 && <Link href={qs(page - 1)} className={buttonClass("outline", "sm")}>{t("job.prev")}</Link>}
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className={buttonClass("outline", "sm")}>{t("job.next")}</Link>}
        </nav>
      )}
    </div>
  );
}
