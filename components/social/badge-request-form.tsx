"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestBadge } from "@/app/actions/social";
import { useT } from "@/lib/i18n/client";

export function BadgeRequestForm({ badge }: { badge: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
        {t("badges.request")}
      </button>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await requestBadge(badge, note);
          if (!res.ok) return setError(res.error === "already_pending" ? t("badges.already_pending") : res.error && !["failed", "invalid"].includes(res.error) ? res.error : t("common.error"));
          router.refresh();
        });
      }}
    >
      <label htmlFor={`bn-${badge}`} className="block text-sm font-semibold">{t("badges.note_label")}</label>
      <textarea id={`bn-${badge}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t(`badges.note_ph.${badge}`)} className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{t("badges.send")}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">{t("badges.cancel")}</button>
      </div>
    </form>
  );
}
