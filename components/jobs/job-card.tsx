import { Briefcase, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { salaryLabel } from "@/lib/jobs";
import { imageUrl } from "@/lib/images";
import type { TFunction } from "@/lib/i18n/shared";

export type JobCardData = {
  id: string;
  title: string;
  company_name: string;
  poster_type: string;
  category: string;
  employment_type: string;
  work_setup: string;
  salary_min: number | string | null;
  salary_max: number | string | null;
  salary_period: string | null;
  vacancies: number;
  created_at: string;
  psgc_cities: { name: string } | null;
  psgc_provinces: { name: string } | null;
  hiring_tags?: string[] | null;
  logo_url?: string | null;
};

/** `extra` (optional) is shown at the bottom of the card, e.g. Jobs 2.0 match reasons. */
/** Badge colours for hiring tags. */
export const TAG_TONE: Record<string, string> = {
  urgent: "bg-danger-soft text-danger", few_slots: "bg-accent-soft text-accent-strong", wait_list: "bg-muted text-muted-foreground",
  seasonal: "bg-brand-soft text-brand-dark", on_call: "bg-brand-soft text-brand-dark", filled: "bg-success-soft text-success",
};

export function HiringTags({ tags, t }: { tags?: string[] | null; t: TFunction }) {
  if (!tags?.length) return null;
  return <>{tags.map((k) => <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-bold ${TAG_TONE[k] ?? "bg-muted"}`}>{t(`job.tag.${k}`)}</span>)}</>;
}

export function JobCard({ job, t, extra, logo }: { job: JobCardData; t: TFunction; extra?: React.ReactNode; logo?: string | null }) {
  const logoPath = job.logo_url ?? logo ?? null;
  const pay = salaryLabel(job.salary_min, job.salary_max, job.salary_period, (p) => t(`job.per.${p}`));
  const where = job.work_setup === "remote" ? t("job.setup.remote") : [job.psgc_cities?.name, job.psgc_provinces?.name].filter(Boolean).join(", ");
  return (
    <li>
      <Link href={`/jobs/${job.id}`} className="block rounded-2xl border border-border bg-white p-4 transition-colors hover:border-brand hover:bg-brand-soft/40">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoPath && <img src={imageUrl(logoPath, "store-assets")} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-xl border border-border bg-white object-contain" />}
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-brand-dark">{job.title}</h3>
            <p className="text-sm text-muted-foreground">
              {job.company_name}
              {job.poster_type === "agency" && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">{t("job.agency")}</span>}
            </p>
          </div>
          </div>
          {pay && <p className="rounded-xl bg-success-soft px-3 py-1 text-sm font-extrabold text-success">{pay}</p>}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1"><Briefcase size={14} aria-hidden /> {t(`job.type.${job.employment_type}`)}</li>
          {where && <li className="flex items-center gap-1"><MapPin size={14} aria-hidden /> {where}</li>}
          <li className="flex items-center gap-1"><Users size={14} aria-hidden /> {t("job.vacancies_n", { n: job.vacancies })}</li>
          <li className="flex items-center gap-1"><Clock size={14} aria-hidden /> {timeAgo(job.created_at)}</li>
        </ul>
        <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          <HiringTags tags={job.hiring_tags} t={t} />
          <span className="rounded-full bg-muted px-2.5 py-1">{t(`job.cat.${job.category}`)}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">{t(`job.setup.${job.work_setup}`)}</span>
        </p>
        {extra}
      </Link>
    </li>
  );
}

export const JOB_CARD_SELECT = `
  id, title, company_name, poster_type, category, employment_type, work_setup, salary_min, salary_max, salary_period, vacancies, created_at, hiring_tags, logo_url,
  psgc_cities ( name ), psgc_provinces ( name )
` as const;
