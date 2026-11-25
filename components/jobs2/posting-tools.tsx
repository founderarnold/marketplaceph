"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { duplicateJobPost, markJobFilled, toggleSavedJob } from "@/app/actions/jobs";
import { ImageUploader } from "@/components/sell/image-uploader";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { HIRING_TAGS } from "@/lib/jobs";

/** Copies a post into a new hidden draft (same owner), then opens its edit page. Applications are not copied. */
export function DuplicateButton({ id, admin = false, size = "md" }: { id: string; admin?: boolean; size?: "sm" | "md" }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" size={size} className="min-h-11 gap-1.5" disabled={pending}
        onClick={() => start(async () => {
          const r = await duplicateJobPost(id);
          if (!r.ok || !r.id) return setError(r.error === "limit" ? t("job.tools.dup_limit") : t("common.error"));
          router.push(admin ? `/admin/job-post/${r.id}` : `/jobs/employer/${r.id}/edit`);
        })}>
        <Copy size={16} aria-hidden /> {pending ? t("job.tools.duplicating") : t("job.tools.duplicate")}
      </Button>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}

/** One tap: "Hired / position filled" — closes the post and shows the Filled badge. */
export function MarkFilledButton({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="md" className="min-h-11" disabled={pending}
      onClick={() => { if (confirm(t("job.tools.filled_confirm"))) start(async () => { await markJobFilled(id); router.refresh(); }); }}>
      {t("job.tools.mark_filled")}
    </Button>
  );
}

/** Form fields shared by "Post a job" and "Edit post": hiring tags, logo, creative and quick deadline buttons. */
export function JobExtrasFields({ userId, tags = [], logo = null, creative = null }: { userId: string; tags?: string[]; logo?: string | null; creative?: string | null }) {
  const { t } = useT();
  const [logoPath, setLogoPath] = useState<string[]>(logo ? [logo] : []);
  const [creativePath, setCreativePath] = useState<string[]>(creative ? [creative] : []);
  const setDeadline = (days: number) => {
    const el = document.querySelector<HTMLInputElement>('input[name="deadline"]');
    if (!el) return;
    const d = new Date();
    d.setDate(d.getDate() + days);
    el.value = d.toISOString().slice(0, 10);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-white p-4" aria-labelledby="jx-h">
      <h2 id="jx-h" className="font-bold text-brand-dark">{t("job.tools.extras")}</h2>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">{t("job.tools.tags")}</legend>
        <div className="flex flex-wrap gap-2">
          {HIRING_TAGS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm">
              <input type="checkbox" name="hiring_tags" value={k} defaultChecked={tags.includes(k)} className="h-5 w-5 accent-[var(--brand)]" /> {t(`job.tag.${k}`)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("job.tools.tags_hint")}</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("job.tools.logo")}</p>
          <ImageUploader userId={userId} value={logoPath} onChange={(v) => setLogoPath(v.slice(-1))} bucket="store-assets" max={1} />
          <input type="hidden" name="logo_url" value={logoPath[0] ?? ""} />
          <p className="text-xs text-muted-foreground">{t("job.tools.logo_hint")}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("job.tools.creative")}</p>
          <ImageUploader userId={userId} value={creativePath} onChange={(v) => setCreativePath(v.slice(-1))} bucket="store-assets" max={1} />
          <input type="hidden" name="creative_url" value={creativePath[0] ?? ""} />
          <p className="text-xs text-muted-foreground">{t("job.tools.creative_hint")}</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t("job.tools.deadline_quick")}</p>
        <div className="flex flex-wrap gap-2">
          {[7, 14, 30, 60].map((d) => (
            <button key={d} type="button" onClick={() => setDeadline(d)} className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">{t("job.tools.days", { n: d })}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Share a job: phone share sheet when available, plus Facebook, Messenger and copy link (with UTM tags). */
/**
 * Share buttons for a job. The link is the readable job address (title and city, e.g.
 * marketplaceph.com/jobs/marketing-manager-san-fernando-pampanga) with nothing added, so it looks safe in Messenger
 * and other chats. Only the Facebook post (where the address is hidden behind a preview card) carries a tracking tag.
 */
export function ShareJob({ url, title, text }: { url: string; title: string; text?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-semibold hover:bg-muted";
  const fb = `${url}?utm_source=facebook&utm_medium=share&utm_campaign=job_share`;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2" aria-label={t("job.tools.share")}>
        {canShare && <button type="button" className={btn} onClick={() => navigator.share({ title, text: text ?? title, url }).catch(() => {})}><Share2 size={16} aria-hidden /> {t("job.tools.share")}</button>}
        <a className={btn} target="_blank" rel="noopener" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fb)}`}>Facebook</a>
        <a className={btn} target="_blank" rel="noopener" href={`fb-messenger://share/?link=${encodeURIComponent(url)}`}><MessageCircle size={16} aria-hidden /> Messenger</a>
        <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
          <Link2 size={16} aria-hidden /> {copied ? t("job.tools.copied") : t("job.tools.copy_link")}
        </button>
      </div>
      <p className="break-all text-xs text-muted-foreground"><span className="sr-only">{t("job.share.link_label")} </span>{url.replace(/^https?:\/\/(www\.)?/, "")}</p>
    </div>
  );
}

/** Save / unsave a job (signed-in job seekers). */
export function SaveJobButton({ id, saved: initial }: { id: string; saved: boolean }) {
  const { t } = useT();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" size="md" className="min-h-11 w-full gap-1.5" disabled={pending} aria-pressed={saved}
      onClick={() => start(async () => { const r = await toggleSavedJob(id); if (r.ok) setSaved(!saved); })}>
      {saved ? <BookmarkCheck size={16} aria-hidden /> : <Bookmark size={16} aria-hidden />} {saved ? t("job.tools.saved") : t("job.tools.save")}
    </Button>
  );
}
