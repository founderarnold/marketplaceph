"use client";

import imageCompression from "browser-image-compression";
import { Camera, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { imageUrl, thumbPath } from "@/lib/images";
import { moderateImage } from "@/lib/moderation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_MAX = 8;

/**
 * Compresses photos on the device (low-bandwidth friendly: ~1280px WebP, <≈400 KB),
 * runs the moderation hook, then uploads to the seller's own folder in storage.
 */
export function ImageUploader({
  userId,
  value,
  onChange,
  bucket: bucketName = "listing-images",
  max = DEFAULT_MAX,
  withThumb = true,
}: {
  userId: string;
  value: string[];
  onChange: (paths: string[]) => void;
  bucket?: "listing-images" | "review-images" | "store-assets";
  max?: number;
  /** Listing photos also get a 400px thumbnail; other uses (e.g. reviews) don't need one. */
  withThumb?: boolean;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createClient();
    const room = max - value.length;
    const picked = Array.from(files).slice(0, room);
    setBusy(picked.length);
    const uploaded: string[] = [];
    for (const file of picked) {
      try {
        const small = await imageCompression(file, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1280,
          fileType: "image/webp",
          useWebWorker: true,
        });
        const verdict = await moderateImage({ name: file.name, type: small.type, size: small.size });
        if (!verdict.allowed) throw new Error(verdict.reason);
        const path = `${userId}/${crypto.randomUUID()}.webp`;
        const bucket = supabase.storage.from(bucketName);
        const { error: upErr } = await bucket.upload(path, small, { contentType: "image/webp" });
        if (upErr) throw upErr;
        if (withThumb) {
          const thumb = await imageCompression(small, { maxSizeMB: 0.05, maxWidthOrHeight: 400, fileType: "image/webp", useWebWorker: true });
          const { error: thumbErr } = await bucket.upload(thumbPath(path), thumb, { contentType: "image/webp" });
          if (thumbErr) {
            await bucket.remove([path]); // keep the invariant: every listing image has a thumbnail
            throw thumbErr;
          }
        }
        uploaded.push(path);
      } catch {
        setError(t("upload.failed"));
      } finally {
        setBusy((b) => b - 1);
      }
    }
    onChange([...value, ...uploaded]);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {value.map((p, i) => (
          <div key={p} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={withThumb ? imageUrl(thumbPath(p), bucketName) : imageUrl(p, bucketName)} alt={`${t("upload.photo")} ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-brand/90 text-center text-[10px] font-bold text-white">{t("upload.cover")}</span>}
            <button
              type="button"
              aria-label={t("upload.remove")}
              onClick={() => onChange(value.filter((x) => x !== p))}
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        {Array.from({ length: Math.max(0, busy) }).map((_, i) => (
          <div key={`busy-${i}`} className="aspect-square animate-pulse rounded-xl bg-muted" aria-label={t("upload.uploading")} />
        ))}
        {value.length + busy < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand/50 bg-brand-soft text-xs font-semibold text-brand-dark"
          >
            <Camera size={22} aria-hidden /> {t("upload.add")}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => handleFiles(e.target.files)} />
      <p className="text-xs text-muted-foreground">{t("upload.hint", { max })}</p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
