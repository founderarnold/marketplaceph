import { Award, BadgeCheck, Clock, ShieldAlert, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/format";
import type { TFunction } from "@/lib/i18n/shared";
import { imageUrl } from "@/lib/images";
import { MIN_RESPONSE_SAMPLE, type ReviewRow, type StoreTrust, type UserTrust } from "@/lib/trust";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-accent" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? "currentColor" : "none"} aria-hidden />
      ))}
    </span>
  );
}

const badgeIcon = { fast_responder: Zap, top_seller: Award, reliable_buyer: BadgeCheck } as const;

/** Earned (computed) badges. Names/descriptions come from the dictionaries. */
export function EarnedBadges({ codes, t }: { codes: string[]; t: TFunction }) {
  if (!codes.length) return null;
  return (
    <>
      {codes.map((c) => {
        const Icon = badgeIcon[c as keyof typeof badgeIcon] ?? Award;
        return (
          <Badge key={c} tone="accent" title={t(`badge.${c}.desc`)}>
            <Icon size={13} aria-hidden /> {t(`badge.${c}`)}
          </Badge>
        );
      })}
    </>
  );
}

export function FlagBanner({ flaggedAt, t }: { flaggedAt: string | null; t: TFunction }) {
  if (!flaggedAt) return null;
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-danger">
      <ShieldAlert className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-bold">{t("flag.title")}</p>
        <p className="text-sm">{t("flag.body", { date: new Date(flaggedAt).toLocaleDateString("en-PH", { month: "long", year: "numeric" }) })}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-bold text-brand-dark">{value}</dd>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(Number(n) * 100)}%`);

export function StoreTrustCard({ trust, t }: { trust: StoreTrust | null; t: TFunction }) {
  if (!trust) return null;
  const rating = trust.avg_rating == null ? null : Number(trust.avg_rating);
  return (
    <section aria-labelledby="trust-h" className="rounded-2xl border border-border bg-white p-4">
      <h2 id="trust-h" className="mb-3 font-bold text-brand-dark">
        {t("trust.title")}
      </h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label={t("trust.rating")}
          value={
            rating == null ? (
              t("trust.no_reviews")
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {rating.toFixed(1)} <Stars value={rating} size={14} />
              </span>
            )
          }
          hint={rating == null ? undefined : t("trust.reviews_n", { n: trust.review_count })}
        />
        <Metric label={t("trust.completed")} value={trust.completed_orders} />
        <Metric label={t("trust.sold")} value={trust.completed_orders > 0 ? t("trust.sold_range", { range: trust.amount_label }) : "—"} />
        <Metric label={t("trust.quantity")} value={trust.completed_orders > 0 ? Number(trust.total_quantity).toLocaleString("en-PH") : "—"} />
        <Metric
          label={t("trust.response")}
          value={trust.response_sample >= MIN_RESPONSE_SAMPLE ? pct(trust.response_rate) : t("trust.new")}
          hint={trust.response_sample >= MIN_RESPONSE_SAMPLE ? t("trust.response_hint") : undefined}
        />
        <Metric label={t("trust.disputes")} value={trust.completed_orders > 0 ? pct(trust.dispute_rate ?? 0) : "—"} />
      </dl>
      <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Clock size={13} className="mt-0.5 shrink-0" aria-hidden /> {t("trust.basis")}
      </p>
    </section>
  );
}

export function BuyerTrustCard({ trust, t }: { trust: Pick<UserTrust, "completed_orders" | "amount_label" | "cancellation_rate" | "avg_rating" | "review_count">; t: TFunction }) {
  const rating = trust.avg_rating == null ? null : Number(trust.avg_rating);
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Metric
        label={t("trust.rating")}
        value={rating == null ? t("trust.no_reviews") : <span className="inline-flex items-center gap-1.5">{rating.toFixed(1)} <Stars value={rating} size={14} /></span>}
        hint={rating == null ? undefined : t("trust.reviews_n", { n: trust.review_count })}
      />
      <Metric label={t("trust.completed")} value={trust.completed_orders} />
      <Metric label={t("trust.ordered")} value={trust.completed_orders > 0 ? t("trust.ordered_range", { range: trust.amount_label }) : "—"} />
      <Metric label={t("trust.cancellation")} value={trust.completed_orders > 0 || trust.cancellation_rate != null ? pct(trust.cancellation_rate ?? 0) : "—"} />
      <Metric label={t("trust.payment")} value={t("trust.soon")} hint={t("trust.payment_hint")} />
    </dl>
  );
}

export function ReviewList({ reviews, t }: { reviews: ReviewRow[]; t: TFunction }) {
  if (!reviews.length) return <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("reviews.empty")}</p>;
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-2xl border border-border bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{r.reviewer_name}</span>
            <time className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</time>
          </div>
          <Stars value={r.rating} size={14} />
          {r.comment && <p className="mt-1 whitespace-pre-line text-sm">{r.comment}</p>}
          {r.photos.length > 0 && (
            <div className="mt-2 flex gap-2">
              {r.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={imageUrl(p, "review-images")} alt="" loading="lazy" width={64} height={64} className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
