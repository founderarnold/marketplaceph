import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { VerificationBadge } from "@/components/listing/badges";
import { VerifyForm } from "@/components/trust/verify-form";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Get verified" };

const steps = [
  { level: 1, key: "verify.step1" },
  { level: 2, key: "verify.step2" },
  { level: 3, key: "verify.step3" },
] as const;

export default async function VerifyPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;

  const { data: store } = await supabase.from("stores").select("id, name, verification_level").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-muted p-8 text-center">
        <p>{t("my.no_store")}</p>
        <Link href="/sell/new" className={buttonClass("accent", "lg")}>{t("nav.post_free")}</Link>
      </div>
    );
  }

  const { data: history } = await supabase
    .from("store_verifications")
    .select("id, target_level, status, submitted_at, reviewer_note, verification_documents ( doc_type )")
    .eq("store_id", store.id)
    .order("submitted_at", { ascending: false })
    .limit(5);
  const pending = history?.find((h) => h.status === "pending");
  const level = store.verification_level;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("verify.title")}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {store.name} <VerificationBadge level={level} t={t} />
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.level} className={`rounded-2xl border p-3 text-sm ${level >= s.level ? "border-success/40 bg-success-soft" : "border-border bg-white"}`}>
            <p className="font-bold text-brand-dark">{level >= s.level ? "✓ " : ""}{t(`${s.key}.title`)}</p>
            <p className="text-xs text-muted-foreground">{t(`${s.key}.body`)}</p>
          </li>
        ))}
      </ol>

      <p className="flex items-start gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">
        <Lock size={16} className="mt-0.5 shrink-0" aria-hidden /> {t("verify.privacy_note")}
      </p>

      {pending ? (
        <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4">
          <p className="font-bold text-accent-strong">{t("verify.pending_title")}</p>
          <p className="text-sm">{t("verify.pending_body", { level: pending.target_level === 3 ? t("verify.business") : t("verify.id"), when: timeAgo(pending.submitted_at) })}</p>
        </div>
      ) : level >= 3 ? (
        <p className="rounded-2xl bg-success-soft p-4 font-semibold text-success">{t("verify.all_done")}</p>
      ) : (
        <VerifyForm userId={userId} storeId={store.id} currentLevel={level} />
      )}

      {history && history.length > 0 && (
        <section aria-labelledby="vh">
          <h2 id="vh" className="mb-2 font-bold text-brand-dark">{t("verify.history")}</h2>
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-border bg-white p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{h.target_level === 3 ? t("verify.business") : t("verify.id")}</span>
                  <Badge tone={h.status === "approved" ? "success" : h.status === "pending" ? "accent" : "danger"}>{t(`verify.status.${h.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{timeAgo(h.submitted_at)} · {h.verification_documents.length} {t("verify.files")}</p>
                {h.reviewer_note && <p className="mt-1">{t("verify.reviewer_note")}: {h.reviewer_note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
