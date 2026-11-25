"use client";

import { MessageSquareText, RotateCcw, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reapplyToJob, sendFollowUp, type CompanionResult } from "@/app/actions/jobs-companion";
import { ShareJob } from "@/components/jobs2/posting-tools";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

const area = "w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

function useAction() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<CompanionResult>) => start(async () => {
    const r = await fn();
    if (!r.ok) {
      setError(r.error === "too_soon" && r.from ? t("comp.follow.from", { date: day(r.from) }) : r.error === "invalid" ? t("comp.follow.invalid") : r.error && r.error !== "failed" && r.error !== "not_found" && r.error !== "status" ? r.error : t("common.error"));
      return;
    }
    setError(null); setDone(true); router.refresh();
  });
  return { pending, error, done, run };
}

/**
 * Follow-up: a ready-to-send polite message to the employer (editable). It is sent in this application's chat,
 * so the employer gets a notification and the reply arrives in Messages. `from` = date it unlocks, only while still waiting.
 */
export function FollowUpButton({ appId, title, company, from, threadHref }: { appId: string; title: string; company: string; from: string | null; threadHref: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => t("comp.follow.template", { title, company }));
  const { pending, error, done, run } = useAction();
  if (done) return <p role="status" className="w-full rounded-xl bg-success-soft p-2 text-sm font-semibold text-success">✓ {t("comp.follow.sent")} <a href={threadHref} className="underline">{t("comp.msg.open")}</a></p>;
  if (from) return <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground">{t("comp.follow.from", { date: day(from!) })}</span>;
  return open ? (
    <div className="w-full space-y-2 rounded-xl bg-muted p-3">
      <label htmlFor={`fu-${appId}`} className="block text-sm font-semibold">{t("comp.follow.label")}</label>
      <textarea id={`fu-${appId}`} value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1000} className={area} />
      <p className="text-xs text-muted-foreground">{t("comp.follow.hint")}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="md" disabled={pending || text.trim().length < 10} onClick={() => run(() => sendFollowUp(appId, text))}>{pending ? t("job.apply.sending") : t("comp.follow.send")}</Button>
        <Button type="button" size="md" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  ) : (
    <Button type="button" size="md" variant="outline" className="min-h-11 gap-1.5" onClick={() => setOpen(true)}><MessageSquareText size={16} aria-hidden /> {t("comp.btn.follow")}</Button>
  );
}

/** Re-Apply: sends a withdrawn (or, after 14 days, a not-selected) application again, with an optional new note. */
export function ReapplyButton({ appId, from }: { appId: string; from: string | null }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { pending, error, done, run } = useAction();
  if (done) return <p role="status" className="w-full rounded-xl bg-success-soft p-2 text-sm font-semibold text-success">✓ {t("comp.reapply.sent")}</p>;
  if (from) return <span className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground">{t("comp.reapply.from", { date: day(from) })}</span>;
  return open ? (
    <div className="w-full space-y-2 rounded-xl bg-muted p-3">
      <label htmlFor={`ra-${appId}`} className="block text-sm font-semibold">{t("comp.reapply.label")}</label>
      <textarea id={`ra-${appId}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder={t("comp.reapply.ph")} className={area} />
      <p className="text-xs text-muted-foreground">{t("comp.reapply.hint")}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="md" variant="accent" disabled={pending} onClick={() => run(() => reapplyToJob(appId, note))}>{pending ? t("job.apply.sending") : t("comp.reapply.send")}</Button>
        <Button type="button" size="md" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  ) : (
    <Button type="button" size="md" variant="outline" className="min-h-11 gap-1.5" onClick={() => setOpen(true)}><RotateCcw size={16} aria-hidden /> {t("comp.btn.reapply")}</Button>
  );
}

/** Share Job to a Friend: opens the phone share sheet / Facebook / Messenger / copy-link row. */
export function ShareToFriend({ url, title }: { url: string; title: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="w-full space-y-1 rounded-xl bg-muted p-3">
      <p className="text-sm font-semibold">{t("comp.share.label")}</p>
      <ShareJob url={url} title={title} />
    </div>
  ) : (
    <Button type="button" size="md" variant="outline" className="min-h-11 gap-1.5" aria-expanded={false} onClick={() => setOpen(true)}><Share2 size={16} aria-hidden /> {t("comp.btn.share")}</Button>
  );
}
