"use client";

import imageCompression from "browser-image-compression";
import { FileText, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

export type UploadedFile = { path: string; name: string };

/**
 * Uploads files to a PRIVATE bucket under the user's own folder. Nothing is previewed from the server:
 * only the filename is shown, because these buckets can't be read back through the public API.
 * Images are shrunk on-device (legible, ≤1800px); PDFs are sent as is.
 */
export function PrivateFileInput({
  userId,
  bucket,
  value,
  onChange,
  max = 1,
  label,
}: {
  userId: string;
  bucket: "private-docs" | "evidence" | "order-files";
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  max?: number;
  label?: string;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const added: UploadedFile[] = [];
    for (const file of Array.from(files).slice(0, max - value.length)) {
      try {
        const isPdf = file.type === "application/pdf";
        if (!isPdf && !file.type.startsWith("image/")) throw new Error("type");
        if (isPdf && file.size > 5 * 1024 * 1024) throw new Error("size");
        const body = isPdf ? file : await imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1800, useWebWorker: true });
        const ext = isPdf ? "pdf" : body.type === "image/png" ? "png" : body.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, body, { contentType: isPdf ? "application/pdf" : body.type });
        if (upErr) throw upErr;
        added.push({ path, name: file.name });
      } catch {
        setError(t("files.failed"));
      }
    }
    setBusy(false);
    if (added.length) onChange([...value, ...added]);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      {value.map((f) => (
        <div key={f.path} className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">
          <FileText size={16} aria-hidden className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <button type="button" aria-label={t("upload.remove")} onClick={() => onChange(value.filter((x) => x.path !== f.path))} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white">
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="btn inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-dashed border-brand/50 bg-white px-3 text-sm font-semibold text-brand-dark disabled:opacity-60"
        >
          <Paperclip size={16} aria-hidden /> {busy ? t("upload.uploading") : (label ?? t("files.add"))}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple={max > 1} className="sr-only" onChange={(e) => handle(e.target.files)} />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
