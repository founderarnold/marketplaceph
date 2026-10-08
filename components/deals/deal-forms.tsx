"use client";

import { Handshake } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { proposeDeal, respondToDeal, submitReview } from "@/app/actions/deals";
import { ImageUploader } from "@/components/sell/image-uploader";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const errorKey = (e?: string) => (e === "needs_chat" ? "deal.err_chat" : e === "invalid" ? "sell.invalid" : "common.error");

/** Seller side, inside a chat: record a sale; the buyer must confirm it. */
export function ProposeDealForm({ conversationId }: { conversationId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border border-border bg-white p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 font-semibold text-brand-dark">
        <Handshake size={18} aria-hidden /> {t("deal.record")}
      </button>
      {open && (
        <form
          className="mt-2 space-y-3"
          action={(fd) =>
            start(async () => {
              const res = await proposeDeal({
                conversationId,
                summary: String(fd.get("summary") ?? ""),
                quantity: Number(fd.get("quantity") || 1),
                amount: Number(fd.get("amount") || 0),
              });
              setMsg({ ok: res.ok, text: res.ok ? t("deal.sent") : t(errorKey(res.error)) });
              if (res.ok) {
                setOpen(false);
                router.refresh();
              }
            })
          }
        >
          <p className="text-xs text-muted-foreground">{t("deal.record_hint")}</p>
          <Field label={t("deal.summary")}>
            <Input name="summary" required minLength={3} maxLength={200} placeholder={t("deal.summary_ph")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("deal.quantity")}>
              <Input name="quantity" type="number" inputMode="numeric" min={1} defaultValue={1} required />
            </Field>
            <Field label={t("deal.amount")}>
              <Input name="amount" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="₱" />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            {t("deal.send")}
          </Button>
        </form>
      )}
      {msg && (
        <p role="status" className={cn("mt-2 text-sm font-medium", msg.ok ? "text-success" : "text-danger")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function DealActions({ orderId, canConfirm }: { orderId: string; canConfirm: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (d: "completed" | "cancelled") =>
    start(async () => {
      const res = await respondToDeal(orderId, d);
      if (!res.ok) setErr(t("common.error"));
      else router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canConfirm && (
        <Button size="sm" disabled={pending} onClick={() => run("completed")}>
          {t("deal.confirm")}
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("cancelled")}>
        {canConfirm ? t("deal.decline") : t("deal.cancel")}
      </Button>
      {err && <span role="alert" className="text-sm text-danger">{err}</span>}
    </div>
  );
}

export function ReviewForm({ orderId, userId, aboutLabel }: { orderId: string; userId: string; aboutLabel: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button size="sm" variant="accent" onClick={() => setOpen(true)}>
        {t("review.leave", { who: aboutLabel })}
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-3 rounded-xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitReview({ orderId, rating, comment, photos });
          if (!res.ok) return setErr(res.error === "already" ? t("review.already") : t("common.error"));
          router.refresh();
        });
      }}
    >
      <p className="font-semibold text-brand-dark">{t("review.how", { who: aboutLabel })}</p>
      <div role="radiogroup" aria-label={t("trust.rating")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}`}
            onClick={() => setRating(n)}
            className={cn("h-11 w-11 rounded-xl border text-lg font-bold", rating === n ? "border-accent bg-accent text-brand-dark" : "border-border bg-white")}
          >
            {n}
          </button>
        ))}
      </div>
      <Field label={t("review.comment")} hint={t("store.optional")}>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} className="min-h-20" />
      </Field>
      <ImageUploader userId={userId} value={photos} onChange={setPhotos} bucket="review-images" max={4} withThumb={false} />
      {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t("review.submit")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("review.public_note")}</p>
    </form>
  );
}
