"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { applyToJob } from "@/app/actions/jobs";
import { recordJobEvent } from "@/app/actions/jobs2";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

type Doc = { id: string; kind: string; title: string | null };

/**
 * Jobs 2.0 P5 application review (flag jobs2_matching): who you are applying to, readiness gaps (never blocking),
 * a short value-first note, exactly which documents are shared, a scam reminder and a final consent.
 * Submitting twice is harmless: the button locks while sending and the database allows one application per job.
 */
export function ApplyReview({ postId, title, company, verified, docs, requested, gaps, resumeHref }: {
  postId: string; title: string; company: string; verified: boolean; docs: Doc[]; requested: string[]; gaps: string[]; resumeHref: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(docs.filter((d) => requested.includes(d.kind)).map((d) => d.id));
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sending = useRef(false);
  const started = useRef(false);
  const have = new Set(docs.filter((d) => picked.includes(d.id)).map((d) => d.kind));
  const missing = requested.filter((k) => !have.has(k));

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    recordJobEvent("apply_start", { job_id: postId }).catch(() => {});
  }, [postId]);

  const submit = () => {
    if (sending.current || !agree) return;
    sending.current = true;
    setError(null);
    start(async () => {
      try {
        const res = await applyToJob(postId, note, picked);
        if (!res.ok && !/already applied/i.test(res.error ?? "")) {
          setError(res.error && res.error !== "failed" ? res.error : t("common.error"));
          recordJobEvent("apply_failed", { job_id: postId, source: res.error === "failed" || !res.error ? "server" : "rule" }).catch(() => {});
          return;
        }
        recordJobEvent("apply_submitted", { job_id: postId }).catch(() => {});
        router.refresh();
      } catch {
        setError(t("job5.offline"));
      } finally {
        sending.current = false;
      }
    });
  };

  const section = "space-y-2 rounded-xl border border-border p-3";
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <section className={section} aria-labelledby="ar-1">
        <h3 id="ar-1" className="text-sm font-bold text-brand-dark">1. {t("job5.review.job")}</h3>
        <p className="font-semibold">{title}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {company}
          {verified
            ? <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success"><BadgeCheck size={14} aria-hidden /> {t("job5.review.verified")}</span>
            : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t("job5.review.unverified")}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{t("job5.review.badge_scope")}</p>
      </section>

      {gaps.length > 0 && (
        <section className={section} aria-labelledby="ar-2">
          <h3 id="ar-2" className="text-sm font-bold text-brand-dark">2. {t("job5.review.ready")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{gaps.map((g) => <li key={g}>{t(`job3.miss.${g}`)}</li>)}</ul>
          <p className="text-xs text-muted-foreground">{t("job5.review.ready_hint")}</p>
        </section>
      )}

      <section className={section} aria-labelledby="ar-3">
        <h3 id="ar-3" className="text-sm font-bold text-brand-dark">3. {t("job5.review.note")}</h3>
        <label className="sr-only" htmlFor="ar-note">{t("job.apply.note")}</label>
        <textarea id="ar-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={4} placeholder={t("job5.review.note_ph")}
          className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40" />
        <details className="text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">{t("job5.review.note_examples")}</summary>
          <ul className="space-y-2">
            {[1, 2].map((n) => (
              <li key={n} className="rounded-lg bg-muted p-2">
                <span className="mr-1 rounded bg-white px-1.5 text-xs font-bold uppercase text-accent-strong">{t("job4.example_label")}</span>{t(`job5.review.ex${n}`)}
                <Button type="button" variant="ghost" size="md" className="mt-1" onClick={() => setNote((v) => (v ? v : t(`job5.review.ex${n}`)))}>{t("job4.use_example")}</Button>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <fieldset className={section}>
        <legend className="px-1 text-sm font-bold text-brand-dark">4. {t("job5.review.docs")}</legend>
        {requested.length > 0 && <p className="text-sm"><b>{t("job.apply.asked")}</b> {requested.map((k) => t(`job.doc.${k}`)).join(", ")}</p>}
        {docs.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("job.apply.no_docs")}</p>}
        {docs.map((d) => (
          <label key={d.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3 text-sm">
            <input type="checkbox" checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} className="h-5 w-5 accent-[var(--brand)]" />
            <span><b>{t(`job.doc.${d.kind}`)}</b>{d.title && <span className="text-muted-foreground"> · {d.title}</span>}</span>
          </label>
        ))}
        {missing.length > 0 && <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent-strong" role="status">{t("job.apply.missing", { list: missing.map((k) => t(`job.doc.${k}`)).join(", ") })}</p>}
        {resumeHref && !docs.some((d) => d.kind === "resume") && <Link href={resumeHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">{t("job4.make_resume")}</Link>}
        <p className="text-xs text-muted-foreground">{t("job5.review.shared_exactly", { n: picked.length })} {t("job.apply.privacy")}</p>
      </fieldset>

      <section className="space-y-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark" aria-labelledby="ar-5">
        <h3 id="ar-5" className="flex items-center gap-1.5 font-bold"><ShieldAlert size={16} aria-hidden /> 5. {t("job5.review.safety")}</h3>
        <p>{t("job4.lesson5.body")}</p>
        <label className="flex min-h-11 items-start gap-3 font-semibold">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
          <span>{t("job5.review.consent", { company })}</span>
        </label>
      </section>

      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending || !agree}>{pending ? t("job.apply.sending") : t("job5.review.submit")}</Button>
    </form>
  );
}
