"use client";

import { Flag, Heart, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { submitReport, toggleFavorite } from "@/app/actions/engage";
import { Button } from "@/components/ui/button";
import { PrivateFileInput, type UploadedFile } from "@/components/trust/private-files";
import { Field, Select, Textarea } from "@/components/ui/field";
import { REPORT_REASONS } from "@/lib/domain";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  listingId,
  storeId,
  initialSaved,
  label,
}: {
  listingId?: string;
  storeId?: string;
  initialSaved: boolean;
  label?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? t("fav.remove") : t("fav.add")}
      onClick={() =>
        start(async () => {
          const res = await toggleFavorite({ listingId, storeId });
          if (res.error === "auth") return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
          if (res.ok) setSaved(!!res.saved);
        })
      }
      className={cn(
        "btn inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 font-semibold",
        saved ? "text-danger" : "text-foreground",
      )}
    >
      <Heart size={20} fill={saved ? "currentColor" : "none"} aria-hidden />
      {label && (saved ? t("fav.saved") : t("fav.save"))}
    </button>
  );
}

export function ShareButton({ title }: { title: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* user cancelled → fall back to copy */
          }
        }
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 font-semibold"
    >
      <Share2 size={20} aria-hidden /> {copied ? t("share.copied") : t("share.share")}
    </button>
  );
}

export function ReportButton({ targetType, targetId, userId }: { targetType: "listing" | "store"; targetId: string; userId?: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<UploadedFile[]>([]);
  const [pending, start] = useTransition();

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-sm text-muted-foreground underline">
        <Flag size={14} aria-hidden /> {t("report.open")}
      </button>
      {open && (
        <form
          className="mt-2 space-y-3 rounded-2xl border border-border bg-muted p-4"
          action={(fd) =>
            start(async () => {
              const res = await submitReport({
                targetType,
                targetId,
                reason: fd.get("reason") as (typeof REPORT_REASONS)[number],
                details: String(fd.get("details") ?? ""),
                evidence: evidence.map((e) => ({ path: e.path, note: e.name.slice(0, 120) })),
              });
              if (res.error === "auth") return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
              setMsg(res.ok ? t("report.sent") : res.error === "limit" ? t("report.limit") : res.error === "duplicate" ? t("report.duplicate") : t("common.error"));
              if (res.ok) setOpen(false);
            })
          }
        >
          <p className="text-xs text-muted-foreground">{t("report.notice")}</p>
          <Field label={t("report.reason")}>
            <Select name="reason" required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`report.reason.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("report.details")}>
            <Textarea name="details" maxLength={2000} />
          </Field>
          {userId && (
            <Field label={t("report.evidence")} hint={t("report.evidence_hint")}>
              <PrivateFileInput userId={userId} bucket="evidence" value={evidence} onChange={setEvidence} max={5} label={t("report.add_evidence")} />
            </Field>
          )}
          <Button type="submit" disabled={pending} size="sm">
            {t("report.submit")}
          </Button>
        </form>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm text-success">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Counts a view once per page load without needing an UPDATE policy on listings. */
export function ViewPing({ listingId }: { listingId: string }) {
  useEffect(() => {
    createClient().rpc("bump_listing_view", { p_listing: listingId }).then(() => {});
  }, [listingId]);
  return null;
}
