import { GraduationCap, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ApplicantActions } from "@/components/jobs/employer-actions";
import { JobDocButton } from "@/components/jobs/job-parts";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ageFrom, salaryLabel } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Applicants" };

export default function Applicants(props: PageProps<"/jobs/employer/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <ApplicantList params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ApplicantList({ params, searchParams }: Pick<PageProps<"/jobs/employer/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect(`/login?next=/jobs/employer/${id}`);

  const { data: post } = await supabase.from("job_posts").select("id, title, company_name, status, vacancies, owner_id").eq("id", id).maybeSingle();
  if (!post || post.owner_id !== userId) notFound();

  const { data: apps } = await supabase
    .from("job_applications")
    .select("id, applicant_id, note, status, employer_note, shared_doc_ids, created_at")
    .eq("post_id", id)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  const ids = (apps ?? []).map((a) => a.applicant_id);
  const docIds = (apps ?? []).flatMap((a) => a.shared_doc_ids);
  const [{ data: profiles }, { data: docs }] = await Promise.all([
    ids.length ? supabase.from("job_profiles").select("*, psgc_cities ( name ), psgc_provinces ( name )").in("user_id", ids) : Promise.resolve({ data: [] }),
    docIds.length ? supabase.from("job_documents").select("id, kind, title").in("id", docIds) : Promise.resolve({ data: [] }),
  ]);
  const prof = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const doc = new Map((docs ?? []).map((d) => [d.id, d]));

  return (
    <div className="space-y-4">
      <Link href="/jobs/employer" className="text-sm font-semibold text-brand underline">← {t("job.emp.title")}</Link>
      {sp.posted && <p role="status" className="rounded-xl bg-success-soft p-3 font-semibold text-success">✓ {t("job.post.posted_ok")}</p>}
      <header>
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{post.title}</h1>
        <p className="text-muted-foreground">{post.company_name} · {t("job.emp.applicants_n", { n: apps?.length ?? 0 })} · <Link href={`/jobs/${post.id}`} className="text-brand underline">{t("job.emp.preview")}</Link></p>
      </header>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("job.emp.privacy")}</p>

      {!apps?.length ? (
        <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("job.emp.no_applicants")}</p>
      ) : (
        <ul className="space-y-4">
          {apps.map((a) => {
            const p = prof.get(a.applicant_id);
            const age = ageFrom(p?.birthdate);
            const pay = p ? salaryLabel(p.expected_salary_min, p.expected_salary_max, "month", (k) => t(`job.per.${k}`)) : null;
            return (
              <li key={a.id} className="space-y-3 rounded-2xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-brand-dark">{p?.full_name ?? "—"}</h2>
                    {p?.headline && <p className="text-sm text-muted-foreground">{p.headline}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={a.status === "hired" || a.status === "shortlisted" || a.status === "interview" ? "success" : a.status === "rejected" ? "neutral" : "brand"}>{t(`job.status.${a.status}`)}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                </div>

                {p && (
                  <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {p.phone && <li className="flex items-center gap-1.5"><Phone size={14} aria-hidden /> <a href={`tel:${p.phone}`} className="text-brand underline">{p.phone}</a></li>}
                    {p.contact_email && <li className="flex items-center gap-1.5"><Mail size={14} aria-hidden /> <a href={`mailto:${p.contact_email}`} className="text-brand underline">{p.contact_email}</a></li>}
                    {(p.psgc_cities?.name || p.psgc_provinces?.name) && <li className="flex items-center gap-1.5"><MapPin size={14} aria-hidden /> {[p.psgc_cities?.name, p.psgc_provinces?.name].filter(Boolean).join(", ")}</li>}
                    {p.education_level && <li className="flex items-center gap-1.5"><GraduationCap size={14} aria-hidden /> {t(`job.edu.${p.education_level}`)}</li>}
                    {age != null && <li>{t("job.emp.age", { n: age })}{p.sex && p.sex !== "prefer_not" ? ` · ${t(`job.sex.${p.sex}`)}` : ""}{p.civil_status ? ` · ${t(`job.civil.${p.civil_status}`)}` : ""}</li>}
                    {p.experience_years != null && <li>{t("job.emp.years_exp", { n: p.experience_years })}</li>}
                    {pay && <li>{t("job.emp.expects")}: <b>{pay}</b></li>}
                  </ul>
                )}
                {p?.about && <p className="whitespace-pre-line text-sm">{p.about}</p>}
                {p && p.skills.length > 0 && <p className="flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{s}</span>)}</p>}
                {p && Array.isArray(p.work_history) && p.work_history.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <h3 className="font-bold">{t("job.pf.history")}</h3>
                    <ul className="space-y-1">
                      {(p.work_history as { company?: string; role?: string; from?: string; to?: string; notes?: string }[]).map((h, i) => (
                        <li key={i} className="rounded-lg bg-muted p-2"><b>{h.role}</b> · {h.company} <span className="text-muted-foreground">({h.from || "?"} – {h.to || t("job.emp.present")})</span>{h.notes && <span className="block text-muted-foreground">{h.notes}</span>}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.note && <p className="rounded-xl bg-accent-soft p-3 text-sm"><b>{t("job.emp.cover")}</b> {a.note}</p>}

                <div className="space-y-1">
                  <h3 className="text-sm font-bold">{t("job.emp.documents")}</h3>
                  {a.shared_doc_ids.length === 0 ? <p className="text-sm text-muted-foreground">{t("job.emp.no_docs")}</p> : (
                    <div className="flex flex-wrap gap-2">
                      {a.shared_doc_ids.map((d) => doc.get(d) && <JobDocButton key={d} id={d} label={t(`job.doc.${doc.get(d)!.kind}`)} />)}
                    </div>
                  )}
                </div>
                <Link href={`/jobs/messages/${a.id}`} className={buttonClass("outline", "md", "gap-2")}>
                  <MessageCircle size={16} aria-hidden /> {t("job.msg.message_applicant")}
                </Link>
                <ApplicantActions id={a.id} status={a.status} note={a.employer_note} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
