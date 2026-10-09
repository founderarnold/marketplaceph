"use client";

import imageCompression from "browser-image-compression";
import { Check, FileText, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addJobDocument, deleteJobDocument } from "@/app/actions/jobs";
import { JobDocButton } from "@/components/jobs/job-parts";
import { Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { DOC_KINDS, MAX_DOC_BYTES, type DocKind } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/client";

export type JobDoc = { id: string; kind: string; title: string | null; mime_type: string; size_bytes: number | null; created_at: string };

// The usual set Philippine employers ask for. Shown as a checklist so applicants know what to prepare.
const RECOMMENDED: DocKind[] = ["photo_2x2", "photo_half_body", "resume", "barangay_clearance", "police_clearance", "nbi_clearance", "transcript", "employment_certificate"];

export function DocumentsManager({ userId, docs }: { userId: string; docs: JobDoc[] }) {
  const { t } = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocKind>("resume");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const have = new Set(docs.map((d) => d.kind));
  const done = RECOMMENDED.filter((k) => have.has(k)).length;

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf";
      if (!isPdf && !file.type.startsWith("image/")) throw new Error(t("job.docs.bad_type"));
      // Photos are shrunk on the phone first (readable, but far lighter on mobile data); PDFs are sent as they are.
      const body = isPdf ? file : await imageCompression(file, { maxSizeMB: 1.2, maxWidthOrHeight: 2000, fileType: "image/webp", useWebWorker: true });
      if (body.size > MAX_DOC_BYTES) throw new Error(t("job.docs.too_big"));
      const mime = isPdf ? "application/pdf" : body.type || "image/webp";
      const ext = isPdf ? "pdf" : mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("job-documents").upload(path, body, { contentType: mime });
      if (upErr) throw new Error(t("job.docs.upload_failed"));
      const res = await addJobDocument({ kind, title: title.trim() || undefined, path, mime: mime as "image/webp", size: body.size });
      if (!res.ok) throw new Error(res.error && res.error !== "failed" ? res.error : t("job.docs.upload_failed"));
      setTitle("");
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-4" aria-labelledby="docs-h">
      <div>
        <h2 id="docs-h" className="text-lg font-bold text-brand-dark">{t("job.docs.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("job.docs.intro")}</p>
      </div>

      <div>
        <p className="text-sm font-semibold">{t("job.docs.progress", { n: done, total: RECOMMENDED.length })}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={RECOMMENDED.length}>
          <div className="h-full bg-success" style={{ width: `${(done / RECOMMENDED.length) * 100}%` }} />
        </div>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {RECOMMENDED.map((k) => (
            <li key={k} className={have.has(k) ? "flex items-center gap-1.5 font-semibold text-success" : "flex items-center gap-1.5 text-muted-foreground"}>
              {have.has(k) ? <Check size={14} aria-hidden /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" aria-hidden />} {t(`job.doc.${k}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 rounded-xl bg-muted p-3">
        <label className="block text-sm font-semibold" htmlFor="doc-kind">{t("job.docs.what")}</label>
        <Select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
          {DOC_KINDS.map((k) => <option key={k} value={k}>{t(`job.doc.${k}`)}</option>)}
        </Select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label={t("job.docs.label")} placeholder={t("job.docs.label")} className="h-11 w-full rounded-xl border border-border bg-white px-3 text-base" />
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" id="doc-file" onChange={(e) => upload(e.target.files?.[0])} />
        <label htmlFor="doc-file" className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 font-bold text-white ${busy ? "opacity-60" : "hover:bg-brand-dark"}`}>
          <Upload size={18} aria-hidden /> {busy ? t("job.docs.uploading") : t("job.docs.choose")}
        </label>
        <p className="text-xs text-muted-foreground">{t("job.docs.limits")}</p>
        {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      </div>

      {docs.length === 0 ? (
        <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">{t("job.docs.none")}</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
              <FileText size={18} className="shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <b>{t(`job.doc.${d.kind}`)}</b>
                {d.title && <span className="text-muted-foreground"> · {d.title}</span>}
                <span className="block text-xs text-muted-foreground">{d.mime_type === "application/pdf" ? "PDF" : t("job.docs.image")}{d.size_bytes ? ` · ${Math.max(1, Math.round(d.size_bytes / 1024))} KB` : ""}</span>
              </span>
              <JobDocButton id={d.id} label={t("job.docs.open")} />
              <button
                type="button"
                disabled={pending}
                aria-label={t("job.docs.delete")}
                onClick={() => { if (confirm(t("job.docs.confirm_delete"))) start(async () => { await deleteJobDocument(d.id); router.refresh(); }); }}
                className="grid h-10 w-10 place-items-center rounded-lg text-danger hover:bg-danger-soft"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
