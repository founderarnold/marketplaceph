import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import { MapPin, Search, ShieldCheck } from "lucide-react";
import { todayPH } from "@/lib/format";
import type { Metadata } from "next";
import Link from "next/link";
import { JOB_CARD_SELECT, JobCard, type JobCardData } from "@/components/jobs/job-card";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { getT } from "@/lib/i18n/server";
import { EMPLOYMENT_TYPES, JOB_CATEGORIES, WORK_SETUPS } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { NotifyMeForm } from "@/components/jobs2/notify-form";
import { JobsTracker, TrackedLink } from "@/components/jobs2/tracker";
import { getLocations } from "@/lib/data";
import { isOn } from "@/lib/flags";
import { countBucket } from "@/lib/jobs-events";

export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = {
    title: "Jobs",
    description: "Find jobs near you or hire the right people. Free for job seekers and employers on MarketplacePH.",
  };
  if (!isOn("jobs2_landing")) return base;
  return {
    ...base,
    title: "Jobs: Hanap trabaho? Simulan natin dito.",
    description: "Search jobs by title, company and location. Free for job seekers: no signup needed to browse, and no fees to apply.",
    alternates: { canonical: "/jobs" },
  };
}

/** Popular categories offered as "related roles" when a search finds nothing. */
const RELATED = ["sales_marketing", "food_hospitality", "logistics_driving", "retail", "customer_service", "it_tech"] as const;
const REMOTE_WORDS = /^(remote|online|work from home|wfh|home based|home-based)$/i;

/** Location text -> PSGC city and province codes whose name contains it (no match -> empty lists). */
async function locationCodes(loc: string) {
  const { cities, provinces } = await getLocations();
  const needle = loc.toLowerCase();
  return {
    cities: cities.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 80).map((c) => c.code),
    provinces: provinces.filter((p) => p.name.toLowerCase().includes(needle)).slice(0, 20).map((p) => p.code),
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE = 20;

async function JobsPageContent({ searchParams }: PageProps<"/jobs">) {
  const sp = await searchParams;
  const { t } = await getT();
  const q = first(sp.q).trim().slice(0, 80);
  const category = (JOB_CATEGORIES as readonly string[]).includes(first(sp.category)) ? first(sp.category) : "";
  const type = (EMPLOYMENT_TYPES as readonly string[]).includes(first(sp.type)) ? first(sp.type) : "";
  const setup = (WORK_SETUPS as readonly string[]).includes(first(sp.setup)) ? first(sp.setup) : "";
  const page = Math.max(1, Math.min(50, Number(first(sp.page)) || 1));
  const landing = isOn("jobs2_landing");
  // Location search exists only with the Jobs 2.0 landing; without the flag the board behaves exactly as before.
  const loc = landing ? first(sp.loc).replace(/[%,()"]/g, " ").trim().slice(0, 60) : "";

  const supabase = await createClient();
  let query = supabase
    .from("job_posts")
    .select(JOB_CARD_SELECT, { count: "exact" })
    .eq("status", "active")
    .or(`deadline.is.null,deadline.gte.${todayPH()}`)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, " ")}%,company_name.ilike.%${q.replace(/[%,()]/g, " ")}%`);
  if (category) query = query.eq("category", category);
  if (type) query = query.eq("employment_type", type);
  if (setup) query = query.eq("work_setup", setup);
  if (loc) {
    if (REMOTE_WORDS.test(loc)) query = query.eq("work_setup", "remote");
    else {
      const codes = await locationCodes(loc);
      const parts = [
        ...(codes.cities.length ? [`city_code.in.(${codes.cities.join(",")})`] : []),
        ...(codes.provinces.length ? [`province_code.in.(${codes.provinces.join(",")})`] : []),
      ];
      // An unknown place matches nothing (the zero-match state then offers next steps).
      query = parts.length ? query.or(parts.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }
  const { data, count } = await query.overrideTypes<JobCardData[], { merge: false }>();
  const jobs = data ?? [];
  const pages = Math.ceil((count ?? 0) / PAGE);
  const qs = (n: number) => `/jobs?${new URLSearchParams({ ...(q && { q }), ...(loc && { loc }), ...(category && { category }), ...(type && { type }), ...(setup && { setup }), page: String(n) })}`;

  if (landing) {
    const { data: claims } = await supabase.auth.getClaims();
    const signedIn = !!claims?.claims?.sub;
    const searched = !!(q || loc || category || type || setup);
    return (
      <div className="space-y-4">
        <JobsTracker name={searched ? "job_search" : "jobs_landing_view"} capture={!searched}
          props={{ has_q: !!q, has_loc: !!loc, ...(category && { category }), results: countBucket(count ?? 0) }} />
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job2.hero")}</h1>
          <p className="text-muted-foreground">{t("job2.hero_sub")}</p>
        </header>

        <form action="/jobs" className="space-y-2 rounded-2xl border border-border bg-white p-3" role="search">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input name="q" defaultValue={q} placeholder={t("job.search_ph")} aria-label={t("job.search_ph")} className="pl-10" maxLength={80} />
            </div>
            <div className="relative">
              <MapPin size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input name="loc" defaultValue={loc} placeholder={t("job2.loc_ph")} aria-label={t("job2.loc_ph")} className="pl-10" maxLength={60} />
            </div>
          </div>
          <details className="group" open={!!(category || type || setup)}>
            <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand">{t("job2.more_filters")}</summary>
            <div className="grid grid-cols-1 gap-2 pt-1 min-[400px]:grid-cols-3">
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
            </div>
          </details>
          <div className="grid gap-2 min-[400px]:grid-cols-2">
            <button className={buttonClass("primary", "md", "w-full")}>{t("job2.explore")}</button>
            <TrackedLink event="signup_start" href="/jobs/profile" className={buttonClass("outline", "md", "w-full")}>{t("job2.build_profile")}</TrackedLink>
          </div>
        </form>

        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-brand-dark"><ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("job2.free_note")}</li>
          <li className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-brand-dark"><ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("job2.scam_note")}</li>
        </ul>

        <p className="text-sm text-muted-foreground" aria-live="polite">{t("job.results", { n: count ?? 0 })}</p>

        {jobs.length === 0 ? (
          <section className="space-y-4 rounded-2xl border border-border bg-white p-4" aria-labelledby="zero-h">
            <div>
              <h2 id="zero-h" className="font-bold text-brand-dark">{searched ? t("job.none") : t("job2.empty_board")}</h2>
              <p className="text-sm text-muted-foreground">{t("job2.zero_hint")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <TrackedLink event="signup_start" href="/jobs/profile" className={buttonClass("primary", "md", "w-full sm:w-auto")}>{t("job2.build_profile")}</TrackedLink>
              <NotifyMeForm q={q} loc={loc} category={category} signedIn={signedIn} back={qs(1)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brand-dark">{t("job2.related")}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {RELATED.filter((c) => c !== category).map((c) => (
                  <li key={c}><Link href={`/jobs?category=${c}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">{t(`job.cat.${c}`)}</Link></li>
                ))}
              </ul>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a href="https://www.flameph.org/academy" target="_blank" rel="noopener" className="flex min-h-11 items-center rounded-xl bg-muted p-3 text-sm font-semibold text-brand-dark">{t("job2.learn")}</a>
              <Link href="/jobs/post" className="flex min-h-11 items-center rounded-xl bg-muted p-3 text-sm font-semibold text-brand-dark">{t("job2.employer_post")}</Link>
            </div>
          </section>
        ) : (
          <ul className="space-y-3">{jobs.map((j) => <JobCard key={j.id} job={j} t={t} />)}</ul>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-center gap-3">
            {page > 1 && <Link href={qs(page - 1)} className={buttonClass("outline", "md")}>{t("job.prev")}</Link>}
            <span className="text-sm text-muted-foreground">{page} / {pages}</span>
            {page < pages && <Link href={qs(page + 1)} className={buttonClass("outline", "md")}>{t("job.next")}</Link>}
          </nav>
        )}
      </div>
    );
  }

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

export default function JobsPage(props: PageProps<"/jobs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JobsPageContent {...props} />
    </Suspense>
  );
}
