"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { applyToJob } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

type Doc = { id: string; kind: string; title: string | null };

/** Choose which documents to share with this employer, add a short note and apply. */
export function ApplyPanel({ postId, docs, requested }: { postId: string; docs: Doc[]; requested: string[] }) {
  const { t } = useT();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(docs.filter((d) => requested.includes(d.kind)).map((d) => d.id));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const have = new Set(docs.filter((d) => picked.includes(d.id)).map((d) => d.kind));
  const missing = requested.filter((k) => !have.has(k));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await applyToJob(postId, note, picked);
          if (!res.ok) return setError(res.error && res.error !== "failed" ? res.error : t("common.error"));
          router.refresh();
        });
      }}
    >
      {requested.length > 0 && (
        <p className="text-sm">
          <b>{t("job.apply.asked")}</b> {requested.map((k) => t(`job.doc.${k}`)).join(", ")}
        </p>
      )}
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-semibold">{t("job.apply.share")}</legend>
        {docs.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("job.apply.no_docs")}</p>}
        {docs.map((d) => (
          <label key={d.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-sm">
            <input
              type="checkbox"
              checked={picked.includes(d.id)}
              onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))}
              className="h-5 w-5 accent-[var(--brand)]"
            />
            <span><b>{t(`job.doc.${d.kind}`)}</b>{d.title && <span className="text-muted-foreground"> · {d.title}</span>}</span>
          </label>
        ))}
      </fieldset>
      {missing.length > 0 && (
        <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent-strong" role="status">
          {t("job.apply.missing", { list: missing.map((k) => t(`job.doc.${k}`)).join(", ") })}
        </p>
      )}
      <label className="block text-sm font-semibold" htmlFor="apply-note">{t("job.apply.note")}</label>
      <textarea id="apply-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t("job.apply.note_ph")} className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40" />
      <p className="text-xs text-muted-foreground">{t("job.apply.privacy")}</p>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending}>{pending ? t("job.apply.sending") : t("job.apply.submit")}</Button>
    </form>
  );
}
