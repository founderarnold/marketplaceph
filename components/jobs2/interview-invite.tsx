"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { setApplicationStatus } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

/**
 * Structured interview invitation (flag jobs2_employer_pipeline). It moves the application to "interview" with a
 * clear note (date, time, place or link, contact) through the existing status function, which notifies the applicant.
 */
export function InterviewInvite({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <Button type="button" variant="outline" size="md" className="gap-2" onClick={() => setOpen(true)}><CalendarClock size={16} aria-hidden /> {t("job6.invite")}</Button>;
  return (
    <form className="space-y-2 rounded-xl border border-border p-3" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const s = (k: string) => String(fd.get(k) ?? "").trim();
      if (!s("date") || !s("time") || !s("where")) return setError(t("job6.invite_need"));
      const note = t("job6.invite_note", { date: s("date"), time: s("time"), where: s("where"), contact: s("contact") || "—" }).slice(0, 500);
      start(async () => {
        const res = await setApplicationStatus(id, "interview", note);
        if (!res.ok) return setError(t("common.error"));
        setOpen(false); router.refresh();
      });
    }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("job6.date")}><Input type="date" name="date" required /></Field>
        <Field label={t("job6.time")}><Input type="time" name="time" required /></Field>
      </div>
      <Field label={t("job6.where")} hint={t("job6.where_hint")}><Input name="where" maxLength={160} required /></Field>
      <Field label={t("job6.contact")}><Input name="contact" maxLength={80} /></Field>
      <p className="text-xs text-muted-foreground">{t("job6.invite_fee")}</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="md" disabled={pending}>{t("job6.send_invite")}</Button>
        <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>{t("job4.back")}</Button>
      </div>
    </form>
  );
}
