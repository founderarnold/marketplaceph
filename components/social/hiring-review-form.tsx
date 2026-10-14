"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reviewHiring } from "@/app/actions/social";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** 5-star review + comment after a hiring: the employer rates the applicant, or the applicant rates the employer. */
export function HiringReviewForm({ applicationId, about }: { applicationId: string; about: "employer" | "applicant" }) {
  const { t } = useT();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-2 rounded-2xl border border-accent/40 bg-accent-soft p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setMsg({ ok: false, text: t("rate.pick_stars") });
        start(async () => {
          const res = await reviewHiring(applicationId, rating, comment);
          if (!res.ok) return setMsg({ ok: false, text: res.error === "already_reviewed" ? t("rate.already") : res.error && res.error !== "failed" && res.error !== "invalid" ? res.error : t("common.error") });
          setMsg({ ok: true, text: t("rate.thanks") });
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-bold text-brand-dark">{t(about === "employer" ? "rate.rate_employer" : "rate.rate_applicant")}</p>
      <div role="radiogroup" aria-label={t("rate.stars")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} / 5`} onClick={() => setRating(n)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white">
            <Star size={26} className={cn(n <= rating ? "text-accent" : "text-muted-foreground")} fill={n <= rating ? "currentColor" : "none"} aria-hidden />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={2} placeholder={t("rate.comment_ph")} aria-label={t("rate.comment_ph")} className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none" />
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm font-medium", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p>}
      <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
        {t("rate.submit")}
      </button>
    </form>
  );
}
