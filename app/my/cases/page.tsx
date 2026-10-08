import type { Metadata } from "next";
import { AppealForm, ResponseForm, SharedEvidenceLink } from "@/components/trust/case-forms";
import { Badge } from "@/components/ui/badge";
import { nowMs, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports & appeals" };

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export default async function MyCasesPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const [{ data: about }, { data: filed }] = await Promise.all([
    supabase.rpc("cases_about_me"),
    supabase.from("reports").select("id, target_type, reason, status, created_at").eq("reporter_id", me).order("created_at", { ascending: false }).limit(30),
  ]);

  // evidence the admin chose to share with me, per case
  const shared = new Map<string, { id: string; note: string | null }[]>();
  for (const c of about ?? []) {
    const { data } = await supabase.rpc("evidence_shared_with_me", { p_report: c.report_id });
    shared.set(c.report_id, (data ?? []).map((e) => ({ id: e.id, note: e.note })));
  }
  const now = nowMs();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("cases.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cases.intro")}</p>
      </div>

      <section aria-labelledby="about" className="space-y-3">
        <h2 id="about" className="text-lg font-bold text-brand-dark">{t("cases.about_me")}</h2>
        {!about?.length && <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("cases.none_about")}</p>}
        {about?.map((c) => {
          const open = c.status === "awaiting_response";
          const canRespond = open && !c.has_response && c.response_due_at && new Date(c.response_due_at).getTime() > now;
          const canAppeal = ["warning", "restricted", "flagged"].includes(c.status) && !c.appeal_status && c.appeal_by && new Date(c.appeal_by).getTime() > now;
          return (
            <article key={c.report_id} className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t(`report.reason.${c.reason}`)} · {t(`cases.target.${c.target_type}`)}</p>
                <Badge tone={c.status === "flagged" || c.status === "restricted" ? "danger" : c.status === "awaiting_response" ? "accent" : "neutral"}>
                  {t(`case.status.${c.status}`)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t("cases.reported_on", { date: dateFmt(c.created_at) })}</p>
              {c.details && (
                <blockquote className="rounded-xl bg-muted p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("cases.allegation")}</p>
                  {c.details}
                </blockquote>
              )}
              {(shared.get(c.report_id) ?? []).map((e, i) => (
                <div key={e.id}><SharedEvidenceLink reportId={c.report_id} evidenceId={e.id} label={`${t("cases.evidence")} ${i + 1}${e.note ? ` — ${e.note}` : ""}`} /></div>
              ))}
              {open && c.response_due_at && (
                <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent-strong">
                  {c.has_response ? t("cases.responded") : t("cases.due", { date: dateFmt(c.response_due_at) })}
                </p>
              )}
              {canRespond && <ResponseForm reportId={c.report_id} userId={me} />}
              {c.decided_at && (
                <div className="rounded-xl border border-border p-3 text-sm">
                  <p className="font-semibold">{t("cases.decision")}: {t(`case.status.${c.status}`)} <span className="font-normal text-muted-foreground">({timeAgo(c.decided_at)})</span></p>
                  {c.decision_note && <p className="mt-1 whitespace-pre-line">{c.decision_note}</p>}
                  {c.appeal_by && !c.appeal_status && canAppeal && <p className="mt-2 text-xs text-muted-foreground">{t("cases.appeal_by", { date: dateFmt(c.appeal_by) })}</p>}
                  {c.appeal_status && <p className="mt-2 font-semibold">{t("cases.appeal_status", { status: t(`appeal.status.${c.appeal_status}`) })}</p>}
                </div>
              )}
              {canAppeal && <AppealForm reportId={c.report_id} />}
            </article>
          );
        })}
      </section>

      <section aria-labelledby="filed" className="space-y-3">
        <h2 id="filed" className="text-lg font-bold text-brand-dark">{t("cases.filed")}</h2>
        {!filed?.length && <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("cases.none_filed")}</p>}
        <ul className="space-y-2">
          {filed?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-sm">
              <span>{t(`report.reason.${r.reason}`)} · {t(`cases.target.${r.target_type}`)} <span className="text-muted-foreground">· {timeAgo(r.created_at)}</span></span>
              <Badge tone="neutral">{["open", "under_review", "reviewing", "awaiting_response"].includes(r.status) ? t("cases.filed_review") : t("cases.filed_closed")}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("cases.reporter_privacy")}</p>
      </section>
    </div>
  );
}
