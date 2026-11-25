import { CheckCircle2, Circle, Clock, Sparkles, UserCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { ProRequestButton } from "@/components/jobs/pro-verify-forms";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TFunction } from "@/lib/i18n/shared";
import type { ProCheck } from "@/lib/jobs-verify";

const TIPS = ["1", "2", "3", "4"] as const;

/** Short "why complete documents and verification give you an edge" note for the profile page. */
export function ProEdgeTips({ t }: { t: TFunction }) {
  return (
    <section aria-labelledby="pro-edge-h" className="space-y-2 rounded-2xl border border-success/30 bg-success-soft p-4 text-sm">
      <h2 id="pro-edge-h" className="flex items-center gap-2 text-base font-bold text-success"><Sparkles size={18} aria-hidden /> {t("pro.edge.title")}</h2>
      <p className="leading-relaxed text-foreground">{t("pro.edge.body")}</p>
      <ul className="list-disc space-y-1 pl-5 leading-relaxed text-foreground">{TIPS.map((n) => <li key={n}>{t(`pro.edge.tip_${n}`)}</li>)}</ul>
      <Link href="/jobs/profile#verify" className="inline-flex min-h-11 items-center font-semibold text-brand underline">{t("pro.edge.link")}</Link>
    </section>
  );
}

/**
 * "Verified Professional Account": what it means, the documents checklist (same rule as the database), and the
 * "Submit Request for Account Verification" button, or the request's status.
 */
export function ProVerifyCard({ t, checks, complete, status, reviewerNote }: {
  t: TFunction; checks: ProCheck[]; complete: boolean; status: "have" | "pending" | "rejected" | null; reviewerNote?: string | null;
}) {
  return (
    <section id="verify" aria-labelledby="pro-h" className="scroll-mt-24 space-y-3 rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-soft text-success"><UserCheck size={22} aria-hidden /></span>
        <div className="min-w-0 space-y-1">
          <h2 id="pro-h" className="text-lg font-bold text-brand-dark">{t("pro.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("pro.intro")}</p>
        </div>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {(["1", "2", "3"] as const).map((n) => <li key={n}>{t(`pro.how_${n}`)}</li>)}
      </ol>
      <div>
        <h3 className="mb-1 text-sm font-bold">{t("pro.checklist")}</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.key} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm ${c.ok ? "bg-success-soft text-success" : "bg-muted text-foreground"}`}>
              {c.ok ? <CheckCircle2 size={18} aria-hidden /> : <Circle size={18} aria-hidden />}
              <span>{t(`pro.check.${c.key}`)}<span className="sr-only"> — {c.ok ? t("pro.check.done") : t("pro.check.missing")}</span></span>
            </li>
          ))}
        </ul>
      </div>
      {status === "have" ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-bold text-success"><UserCheck size={16} aria-hidden /> {t("pro.have")}</p>
      ) : status === "pending" ? (
        <p className="flex items-start gap-1.5 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-accent-strong"><Clock size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("pro.pending")}</p>
      ) : (
        <div className="space-y-2">
          {status === "rejected" && (
            <p className="flex items-start gap-1.5 rounded-xl bg-danger-soft p-3 text-sm text-danger"><XCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("pro.rejected")}{reviewerNote ? `: ${reviewerNote}` : ""}</p>
          )}
          {!complete && <p className="text-sm font-semibold text-accent-strong">{t("pro.not_ready")}</p>}
          <ProRequestButton ready={complete} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("pro.privacy")}</p>
    </section>
  );
}

/** Loads what the card needs for the signed-in applicant. */
export async function loadProStatus(supabase: SupabaseClient, userId: string): Promise<{ status: "have" | "pending" | "rejected" | null; reviewerNote: string | null }> {
  const [{ data: have }, { data: last }] = await Promise.all([
    supabase.from("user_badges").select("badge").eq("user_id", userId).eq("badge", "verified_professional").maybeSingle(),
    supabase.from("badge_requests").select("status, reviewer_note").eq("user_id", userId).eq("badge", "verified_professional")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (have) return { status: "have", reviewerNote: null };
  if (last?.status === "pending") return { status: "pending", reviewerNote: null };
  if (last?.status === "rejected") return { status: "rejected", reviewerNote: (last.reviewer_note as string | null) ?? null };
  return { status: null, reviewerNote: null };
}
