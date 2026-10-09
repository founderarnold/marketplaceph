"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moderateJobPost, setApplicationStatus, setPostStatus, withdrawApplication, type JobResult } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { EMPLOYER_STATUSES } from "@/lib/jobs";

function useRun() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<JobResult>) => start(async () => {
    const res = await fn();
    if (!res.ok) setError(res.error && res.error !== "failed" ? res.error : t("common.error"));
    else { setError(null); router.refresh(); }
  });
  return { pending, error, run };
}

/** Move an applicant through the hiring steps, with an optional private note. */
export function ApplicantActions({ id, status, note }: { id: string; status: string; note: string | null }) {
  const { t } = useT();
  const { pending, error, run } = useRun();
  const [text, setText] = useState(note ?? "");
  return (
    <div className="space-y-2">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label={t("job.emp.note")} placeholder={t("job.emp.note")} className="h-10 w-full rounded-xl border border-border px-3 text-sm" />
      <div className="flex flex-wrap gap-1.5">
        {EMPLOYER_STATUSES.filter((s) => s !== "viewed").map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || status === s}
            aria-pressed={status === s}
            onClick={() => run(() => setApplicationStatus(id, s, text))}
            className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${status === s ? "border-brand bg-brand text-white" : "border-border bg-white hover:bg-muted"} disabled:opacity-70`}
          >
            {t(`job.status.${s}`)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function PostStatusButtons({ id, status }: { id: string; status: string }) {
  const { t } = useT();
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {status !== "active" && status !== "removed" && <Button size="sm" disabled={pending} onClick={() => run(() => setPostStatus(id, "active"))}>{t("job.emp.reopen")}</Button>}
      {status === "active" && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setPostStatus(id, "closed"))}>{t("job.emp.close")}</Button>}
      {status === "active" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setPostStatus(id, "hidden"))}>{t("job.emp.hide")}</Button>}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function WithdrawButton({ id }: { id: string }) {
  const { t } = useT();
  const { pending, error, run } = useRun();
  return (
    <span>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(t("job.app.confirm_withdraw"))) run(() => withdrawApplication(id)); }}>{t("job.app.withdraw")}</Button>
      {error && <span role="alert" className="ml-2 text-xs text-danger">{error}</span>}
    </span>
  );
}

export function ModerateButton({ id, removed }: { id: string; removed: boolean }) {
  const { t } = useT();
  const { pending, run } = useRun();
  return (
    <Button size="sm" variant={removed ? "outline" : "ghost"} disabled={pending} onClick={() => run(() => moderateJobPost(id, removed ? "active" : "removed"))}>
      {removed ? t("job.admin.restore") : t("job.admin.remove")}
    </Button>
  );
}
