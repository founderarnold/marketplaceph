"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { appealCase, respondToCase } from "@/app/actions/cases";
import { getSharedEvidenceUrl } from "@/app/actions/verification";
import { PrivateFileInput, type UploadedFile } from "@/components/trust/private-files";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

function useResult() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const fail = (e?: string) => setError(e === "invalid" ? t("sell.invalid") : e && e !== "failed" ? e : t("common.error"));
  return { error, setError, fail };
}

export function ResponseForm({ reportId, userId }: { reportId: string; userId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const { error, setError, fail } = useResult();
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await respondToCase(reportId, body, files.map((f) => f.path));
          if (!res.ok) return fail(res.error);
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-semibold text-brand-dark">{t("cases.respond_title")}</p>
      <Field label={t("cases.your_side")}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={3000} />
      </Field>
      <Field label={t("report.evidence")} hint={t("cases.evidence_hint")}>
        <PrivateFileInput userId={userId} bucket="evidence" value={files} onChange={setFiles} max={4} label={t("report.add_evidence")} />
      </Field>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" disabled={pending}>{t("cases.send_response")}</Button>
      <p className="text-xs text-muted-foreground">{t("cases.respond_once")}</p>
    </form>
  );
}

export function AppealForm({ reportId }: { reportId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const { error, setError, fail } = useResult();
  const [pending, start] = useTransition();
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("cases.appeal")}</Button>;
  return (
    <form
      className="space-y-3 rounded-xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await appealCase(reportId, body);
          if (!res.ok) return fail(res.error === "already" ? t("cases.appeal_already") : res.error);
          router.refresh();
        });
      }}
    >
      <Field label={t("cases.appeal_why")} hint={t("cases.appeal_hint")}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={3000} />
      </Field>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{t("cases.appeal_send")}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </form>
  );
}

export function SharedEvidenceLink({ reportId, evidenceId, label }: { reportId: string; evidenceId: string; label: string }) {
  const { t } = useT();
  const [err, setErr] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand underline"
      onClick={async () => {
        const res = await getSharedEvidenceUrl(reportId, evidenceId);
        if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
        else setErr(true);
      }}
    >
      <ExternalLink size={14} aria-hidden /> {label} {err && <span className="text-danger">({t("common.error")})</span>}
    </button>
  );
}
