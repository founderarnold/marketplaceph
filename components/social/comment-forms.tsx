"use client";

import { Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/app/actions/social";
import { SignInButton } from "@/components/auth/auth-modal";
import { useT } from "@/lib/i18n/client";

export function CommentForm({ kind, targetId, signedIn, isOwner }: { kind: "listing" | "job"; targetId: string; signedIn: boolean; isOwner: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <SignInButton className="inline-flex min-h-11 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft">
        {t("comments.sign_in")}
      </SignInButton>
    );
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addComment(kind, targetId, body);
          if (!res.ok) return setError(res.error === "invalid" ? t("comments.too_short") : res.error && res.error !== "failed" ? res.error : t("common.error"));
          setBody("");
          router.refresh();
        });
      }}
    >
      <label htmlFor={`c-${targetId}`} className="sr-only">{t("comments.title")}</label>
      <textarea
        id={`c-${targetId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder={isOwner ? t("comments.ph_owner") : t(kind === "listing" ? "comments.ph_listing" : "comments.ph_job")}
        className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40"
      />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("comments.public_note")}</p>
        <button type="submit" disabled={pending || body.trim().length < 2} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
          <Send size={16} aria-hidden /> {t("comments.post")}
        </button>
      </div>
    </form>
  );
}

export function DeleteCommentButton({ id, path }: { id: string; path: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={t("comments.delete")}
      disabled={pending}
      onClick={() => confirm(t("comments.confirm_delete")) && start(async () => { await deleteComment(id, path); router.refresh(); })}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 size={14} aria-hidden />
    </button>
  );
}
