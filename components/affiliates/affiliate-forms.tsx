"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { decideAffiliateLink, markCommissionPaid, requestAffiliateLink, revokeAffiliateLink, type AffResult } from "@/app/actions/affiliates";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

function useRun() {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [res, setRes] = useState<AffResult | null>(null);
  const run = (fn: () => Promise<AffResult>) => start(async () => setRes(await fn()));
  const msg = res && !res.ok && (
    <p role="alert" className="text-sm font-semibold text-danger">
      {res.upgrade ? res.error : res.error === "failed" || !res.error ? t("common.error") : res.error}{" "}
      {res.upgrade && <Link href="/business/plan" className="underline">{t("plan.upgrade")}</Link>}
    </p>
  );
  return { pending, run, msg };
}

/** "Promote this item" — asks the seller for approval. */
export function RequestAffiliateButton({ listingId, pct }: { listingId: string; pct: number }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        aria-label={t("aff.message")}
        placeholder={t("aff.message_ph")}
        className="h-11 w-full rounded-xl border border-border px-3 text-sm"
      />
      <Button type="button" variant="accent" disabled={pending} onClick={() => run(() => requestAffiliateLink(listingId, message))}>
        {t("aff.request", { pct })}
      </Button>
      {msg}
    </div>
  );
}

/** Copies a link to the clipboard (falls back to selecting the text on old browsers). */
export function CopyLink({ url }: { url: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("aff.your_link")} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-muted px-3 text-sm" />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            /* the field is selectable, so the user can copy manually */
          }
        }}
        className="min-h-10 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
      >
        {done ? t("aff.copied") : t("aff.copy")}
      </button>
    </div>
  );
}

export function DecideButtons({ linkId }: { linkId: string }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => decideAffiliateLink(linkId, true))}>{t("aff.approve")}</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideAffiliateLink(linkId, false))}>{t("aff.reject")}</Button>
      </div>
      {msg}
    </div>
  );
}

export function RevokeButton({ linkId }: { linkId: string }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  return (
    <span>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(t("aff.confirm_revoke"))) run(() => revokeAffiliateLink(linkId)); }}>
        {t("aff.revoke")}
      </Button>
      {msg}
    </span>
  );
}

export function PaidButton({ commissionId }: { commissionId: string }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  return (
    <span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => { if (confirm(t("aff.confirm_paid"))) run(() => markCommissionPaid(commissionId)); }}>
        {t("aff.mark_paid")}
      </Button>
      {msg}
    </span>
  );
}
