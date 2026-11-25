import type { SupabaseClient } from "@supabase/supabase-js";
import { RemoveBadgeButton } from "@/components/admin/badge-forms";
import { JobDocButton } from "@/components/jobs/job-parts";
import { InterviewForm, ProDecision, type Interview } from "@/components/jobs/pro-verify-forms";
import { Badge } from "@/components/ui/badge";
import { timeAgo, todayPH } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { proChecklist } from "@/lib/jobs-verify";
import { createClient } from "@/lib/supabase/server";

const card = "space-y-3 rounded-2xl border border-border bg-white p-3 text-sm";

type Req = { id: string; user_id: string; note: string | null; created_at: string };
type Prof = { user_id: string; full_name: string; headline: string | null; phone: string | null; contact_email: string | null; consent_at: string | null; skills: string[] };
type Doc = { id: string; user_id: string; kind: string; title: string | null };
type Iv = Interview & { request_id: string; user_id: string; recorded_at: string };

/**
 * Admin → Verified pros: applicants who asked for the "Verified Professional Account" badge. Check the profile and
 * documents (each open is logged), record the face-to-face interview by an appointed or accredited FLAME PH partner,
 * then grant the badge or turn the request down. Holders can lose the badge again here.
 */
export async function ProsAdmin({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  if (!isAdmin) return <p className={card}>{t("adminb.full_admin_only")}</p>;
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const [{ data: reqRows }, { data: holderRows }] = await Promise.all([
    supabase.from("badge_requests").select("id, user_id, note, created_at").eq("badge", "verified_professional").eq("status", "pending").order("created_at").limit(100),
    supabase.from("user_badges").select("user_id, granted_at").eq("badge", "verified_professional").order("granted_at", { ascending: false }).limit(200),
  ]);
  const reqs = (reqRows ?? []) as Req[];
  const holders = (holderRows ?? []) as { user_id: string; granted_at: string }[];
  const reqUsers = reqs.map((r) => r.user_id);
  const allUsers = [...new Set([...reqUsers, ...holders.map((h) => h.user_id)])];
  const none = Promise.resolve({ data: [] });
  const [{ data: profRows }, { data: docRows }, { data: ivRows }, { data: names }] = await Promise.all([
    reqUsers.length ? supabase.from("job_profiles").select("user_id, full_name, headline, phone, contact_email, consent_at, skills").in("user_id", reqUsers) : none,
    reqUsers.length ? supabase.from("job_documents").select("id, user_id, kind, title").in("user_id", reqUsers).order("created_at") : none,
    allUsers.length ? supabase.from("pro_verification_interviews").select("*").in("user_id", allUsers).order("recorded_at", { ascending: false }) : none,
    allUsers.length ? supabase.from("profiles").select("id, display_name").in("id", allUsers) : none,
  ]);
  const prof = new Map(((profRows ?? []) as Prof[]).map((p) => [p.user_id, p]));
  const docs = (docRows ?? []) as Doc[];
  const ivs = (ivRows ?? []) as Iv[];
  const nm = new Map(((names ?? []) as { id: string; display_name: string }[]).map((n) => [n.id, n.display_name]));
  const today = todayPH();

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("pro.admin.howto")}</p>
      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">{t("pro.admin.pending", { n: reqs.length })}</h2>
        {!reqs.length && <p className="text-sm text-muted-foreground">{t("adminb.none")}</p>}
        {reqs.map((r) => {
          const p = prof.get(r.user_id) ?? null;
          const mine = docs.filter((d) => d.user_id === r.user_id);
          const check = proChecklist(p, mine);
          const iv = ivs.find((x) => x.request_id === r.id) ?? null;
          return (
            <article key={r.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-brand-dark">{p?.full_name ?? nm.get(r.user_id) ?? r.user_id} <span className="font-normal text-muted-foreground">· {timeAgo(r.created_at)}</span></p>
                <Badge tone={check.complete ? "success" : "danger"}>{check.complete ? t("pro.admin.docs_ok") : t("pro.admin.docs_missing")}</Badge>
              </div>
              {p?.headline && <p className="text-muted-foreground">{p.headline}</p>}
              <p className="text-muted-foreground">{[p?.phone, p?.contact_email].filter(Boolean).join(" · ")}</p>
              {r.note && <p className="whitespace-pre-line rounded-lg bg-muted p-2"><b>{t("pro.admin.their_note")}:</b> {r.note}</p>}
              <ul className="flex flex-wrap gap-1.5 text-xs">
                {check.items.map((c) => <li key={c.key} className={`rounded-full px-2 py-1 font-semibold ${c.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{c.ok ? "✓" : "✗"} {t(`pro.check.${c.key}`)}</li>)}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {mine.map((d) => <JobDocButton key={d.id} id={d.id} label={t(`job.doc.${d.kind}`)} />)}
              </div>
              <InterviewForm requestId={r.id} current={iv} today={today} />
              <ProDecision requestId={r.id} canGrant={!!iv && iv.result === "passed" && check.complete} />
            </article>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">{t("pro.admin.holders", { n: holders.length })}</h2>
        {!holders.length && <p className="text-sm text-muted-foreground">{t("adminb.none")}</p>}
        <ul className="space-y-1">
          {holders.map((h) => {
            const iv = ivs.find((x) => x.user_id === h.user_id && x.result === "passed");
            return (
              <li key={h.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-white p-3 text-sm">
                <span>
                  <b>{nm.get(h.user_id) ?? h.user_id}</b> · {timeAgo(h.granted_at)}
                  {iv && <span className="block text-xs text-muted-foreground">{t("pro.admin.interviewed_by", { partner: iv.partner_name, kind: t(`pro.kind.${iv.partner_kind}`), date: iv.interviewed_on })}</span>}
                </span>
                <RemoveBadgeButton userId={h.user_id} badge="verified_professional" />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
