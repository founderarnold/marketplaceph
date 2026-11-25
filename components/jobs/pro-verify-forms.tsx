"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideProRequest, recordProInterview, requestProVerification, type R } from "@/app/actions/jobs-verify";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { PRO_PARTNER_KINDS, PRO_RESULTS } from "@/lib/jobs-verify";

function useRun() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) return setMsg(res.error === "already_pending" ? t("badges.already_pending") : res.error && !["failed", "invalid", "auth"].includes(res.error) ? res.error : t("common.error"));
      after?.();
      router.refresh();
    });
  return { pending, run, msg };
}

/** Applicant: "Submit Request for Account Verification", with an optional note (where / when they can be interviewed). */
export function ProRequestButton({ ready }: { ready: boolean }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <Button type="button" variant="accent" size="lg" className="w-full sm:w-auto" disabled={!ready} onClick={() => setOpen(true)}>
        {t("pro.request")}
      </Button>
    );
  }
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => requestProVerification(note)); }}>
      <label htmlFor="pro-note" className="block text-sm font-semibold">{t("pro.note_label")}</label>
      <Textarea id="pro-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t("pro.note_ph")} />
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="accent" disabled={pending}>{pending ? t("job.apply.sending") : t("pro.send")}</Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("badges.cancel")}</Button>
      </div>
    </form>
  );
}

export type Interview = {
  partner_name: string; partner_kind: string; partner_ref: string | null; interviewed_on: string; place: string | null; result: string; notes: string | null;
};

/** Admin: record (or correct) the face-to-face interview for one request. */
export function InterviewForm({ requestId, current, today }: { requestId: string; current: Interview | null; today: string }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState({
    partnerName: current?.partner_name ?? "", partnerKind: current?.partner_kind ?? "accredited", partnerRef: current?.partner_ref ?? "",
    date: current?.interviewed_on ?? today, place: current?.place ?? "", result: current?.result ?? "passed", notes: current?.notes ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => { setSaved(false); setV((x) => ({ ...x, [k]: e.target.value })); };
  const id = (k: string) => `iv-${requestId.slice(0, 8)}-${k}`;
  const lbl = "block text-xs font-semibold text-muted-foreground";
  return (
    <form
      className="space-y-2 rounded-xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => recordProInterview({ requestId, ...v, partnerKind: v.partnerKind as (typeof PRO_PARTNER_KINDS)[number], result: v.result as (typeof PRO_RESULTS)[number] }), () => setSaved(true));
      }}
    >
      <p className="text-sm font-bold text-brand-dark">{t("pro.admin.interview")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className={lbl} htmlFor={id("name")}>{t("pro.admin.partner_name")}</label><Input id={id("name")} required minLength={2} maxLength={120} value={v.partnerName} onChange={set("partnerName")} /></div>
        <div>
          <label className={lbl} htmlFor={id("kind")}>{t("pro.admin.partner_kind")}</label>
          <Select id={id("kind")} value={v.partnerKind} onChange={set("partnerKind")}>{PRO_PARTNER_KINDS.map((k) => <option key={k} value={k}>{t(`pro.kind.${k}`)}</option>)}</Select>
        </div>
        <div><label className={lbl} htmlFor={id("ref")}>{t("pro.admin.partner_ref")}</label><Input id={id("ref")} maxLength={80} value={v.partnerRef} onChange={set("partnerRef")} placeholder={t("pro.admin.partner_ref_ph")} /></div>
        <div><label className={lbl} htmlFor={id("date")}>{t("pro.admin.date")}</label><Input id={id("date")} type="date" required max={today} value={v.date} onChange={set("date")} /></div>
        <div><label className={lbl} htmlFor={id("place")}>{t("pro.admin.place")}</label><Input id={id("place")} maxLength={160} value={v.place} onChange={set("place")} placeholder={t("pro.admin.place_ph")} /></div>
        <div>
          <label className={lbl} htmlFor={id("result")}>{t("pro.admin.result")}</label>
          <Select id={id("result")} value={v.result} onChange={set("result")}>{PRO_RESULTS.map((k) => <option key={k} value={k}>{t(`pro.result.${k}`)}</option>)}</Select>
        </div>
      </div>
      <div><label className={lbl} htmlFor={id("notes")}>{t("pro.admin.notes")}</label><Textarea id={id("notes")} maxLength={1000} rows={2} value={v.notes} onChange={set("notes")} /></div>
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{current ? t("pro.admin.update_interview") : t("pro.admin.save_interview")}</Button>
        {saved && <span role="status" className="text-sm font-semibold text-success">✓ {t("pro.admin.saved")}</span>}
      </div>
    </form>
  );
}

/** Admin: grant the badge (needs a passed interview) or turn the request down with a note to the applicant. */
export function ProDecision({ requestId, canGrant }: { requestId: string; canGrant: boolean }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("adminb.note_ph")} aria-label={t("adminb.note_ph")} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || !canGrant} onClick={() => run(() => decideProRequest(requestId, true, note))}>{t("pro.admin.grant")}</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideProRequest(requestId, false, note))}>{t("adminb.reject")}</Button>
      </div>
      {!canGrant && <p className="text-xs text-muted-foreground">{t("pro.admin.grant_needs")}</p>}
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
    </div>
  );
}
