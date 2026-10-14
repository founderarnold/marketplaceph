import { BadgeCheck, Briefcase, CalendarCheck, Clock, ShieldCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { BadgeRequestForm } from "@/components/social/badge-request-form";
import { getT } from "@/lib/i18n/server";
import { BADGES } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Badges" };

const icons = { verified_buyer: ShieldCheck, good_applicant: BadgeCheck, credible_employer: Briefcase, years_verified: CalendarCheck } as const;

/** Request trust badges; an admin, the founder or the webmaster reviews each request. */
async function BadgesContent() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;
  const [{ data: have }, { data: reqs }] = await Promise.all([
    supabase.from("user_badges").select("badge, granted_at").eq("user_id", me),
    supabase.from("badge_requests").select("badge, status, reviewer_note, created_at").eq("user_id", me).order("created_at", { ascending: false }),
  ]);
  const owned = new Set((have ?? []).map((b) => b.badge));
  const latest = new Map<string, { status: string; reviewer_note: string | null }>();
  for (const r of reqs ?? []) if (!latest.has(r.badge)) latest.set(r.badge, r);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("badges.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("badges.intro")}</p>
      </div>
      <ul className="space-y-3">
        {BADGES.map((b) => {
          const Icon = icons[b];
          const last = latest.get(b);
          return (
            <li key={b} className="rounded-2xl border border-border bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-success-soft text-success"><Icon size={22} aria-hidden /></span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h2 className="font-bold text-brand-dark">{t(`badge.${b}`)}</h2>
                    <p className="text-sm text-muted-foreground">{t(`badge.${b}.desc`)}</p>
                    <p className="mt-1 text-xs text-muted-foreground"><b>{t("badges.needs")}:</b> {t(`badges.needs.${b}`)}</p>
                  </div>
                  {owned.has(b) ? (
                    <p className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-sm font-semibold text-success"><BadgeCheck size={16} aria-hidden /> {t("badges.have")}</p>
                  ) : last?.status === "pending" ? (
                    <p className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-strong"><Clock size={16} aria-hidden /> {t("badges.pending")}</p>
                  ) : (
                    <>
                      {last?.status === "rejected" && (
                        <p className="flex items-start gap-1 rounded-xl bg-danger-soft p-2 text-sm text-danger">
                          <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("badges.rejected")}{last.reviewer_note ? `: ${last.reviewer_note}` : ""}
                        </p>
                      )}
                      <BadgeRequestForm badge={b} />
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
        {t("badges.seller_note")} <Link href="/sell/verify" className="font-semibold underline">{t("verify.title")}</Link>
      </p>
    </div>
  );
}

export default function BadgesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BadgesContent />
    </Suspense>
  );
}
