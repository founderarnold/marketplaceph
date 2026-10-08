import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { SheetActions } from "@/components/trust/sheet-actions";
import { BuyerTrustCard, EarnedBadges, ReviewList } from "@/components/trust/trust-ui";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { loadReviews } from "@/lib/trust";

export const metadata: Metadata = { title: "Buyer information sheet", robots: { index: false } };

export default function BuyerSheetPage(props: PageProps<"/buyer/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <BuyerSheet params={props.params} />
    </Suspense>
  );
}

async function BuyerSheet({ params }: Pick<PageProps<"/buyer/[id]">, "params">) {
  const { id } = await params;
  const { t } = await getT();
  const valid = z.uuid().safeParse(id).success;
  const supabase = await createClient();
  // The database decides who may see a buyer sheet: the buyer themself, admins, people they have chatted with, or anyone if the buyer opted in.
  const { data } = valid ? await supabase.rpc("buyer_sheet", { p_user: id }) : { data: null };
  const sheet = data?.[0];
  if (!sheet) {
    return (
      <div className="mx-auto max-w-md space-y-2 rounded-3xl bg-muted p-8 text-center">
        <h1 className="text-xl font-bold text-brand-dark">{t("sheet.private_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("sheet.private_body")}</p>
      </div>
    );
  }
  const reviews = await loadReviews(supabase, { revieweeId: id, direction: "seller_to_buyer" }, 5);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SheetActions title={`${sheet.display_name} — MarketplacePH`} />
      <article className="print-sheet space-y-4 rounded-3xl border border-border bg-white p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sheet.buyer_title")}</p>
            <h1 className="text-2xl font-extrabold text-brand-dark">{sheet.display_name}</h1>
            <p className="text-sm text-muted-foreground">{t("sheet.member_since")}: {new Date(sheet.member_since).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.webp" alt="MarketplacePH" className="h-12 w-auto" />
        </header>
        <div className="flex flex-wrap gap-1.5">
          <EarnedBadges codes={sheet.badges} t={t} />
        </div>
        <BuyerTrustCard
          trust={{ completed_orders: sheet.trust_completed, amount_label: sheet.trust_amount, cancellation_rate: sheet.cancellation_rate, avg_rating: sheet.avg_rating, review_count: sheet.review_count }}
          t={t}
        />
        {reviews.length > 0 && (
          <section aria-labelledby="br">
            <h2 id="br" className="mb-2 font-bold text-brand-dark">{t("reviews.from_sellers")}</h2>
            <ReviewList reviews={reviews} t={t} />
          </section>
        )}
        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          <p>{t("sheet.disclaimer")}</p>
          <p className="mt-1">{t("sheet.generated", { date: new Date().toLocaleDateString("en-PH") })}</p>
        </footer>
      </article>
    </div>
  );
}
