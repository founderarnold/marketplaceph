import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerTypeBadge, VerificationBadge } from "@/components/listing/badges";
import { SheetActions } from "@/components/trust/sheet-actions";
import { EarnedBadges, FlagBanner, ReviewList, StoreTrustCard } from "@/components/trust/trust-ui";
import { yearsInBusinessBadge } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";
import { loadReviews, loadStoreTrust } from "@/lib/trust";

export const metadata: Metadata = { title: "Seller information sheet" };

export default function SheetPage(props: PageProps<"/store/[slug]/sheet">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Sheet params={props.params} />
    </Suspense>
  );
}

async function Sheet({ params }: Pick<PageProps<"/store/[slug]/sheet">, "params">) {
  const { slug } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select(
      `id, slug, name, tagline, description, logo_url, seller_type, verification_level, year_started, created_at, contact_phone, facebook_url,
       psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!store) notFound();

  const [{ trust, badges, flaggedAt }, reviews] = await Promise.all([
    loadStoreTrust(supabase, store.id),
    loadReviews(supabase, { storeId: store.id, direction: "buyer_to_seller" }, 3),
  ]);
  const years = yearsInBusinessBadge(store.year_started);
  const where = [store.psgc_cities?.name, store.psgc_provinces?.name, store.psgc_regions?.short_name].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href={`/store/${store.slug}`} className="text-sm font-semibold text-brand hover:underline">
          ← {store.name}
        </Link>
        <SheetActions title={`${store.name} — MarketplacePH`} />
      </div>

      <article className="print-sheet space-y-4 rounded-3xl border border-border bg-white p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={store.logo_url ? imageUrl(store.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" className="h-16 w-16 rounded-2xl border border-border object-contain" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sheet.seller_title")}</p>
              <h1 className="text-2xl font-extrabold text-brand-dark">{store.name}</h1>
              {store.tagline && <p className="text-sm text-muted-foreground">{store.tagline}</p>}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.webp" alt="MarketplacePH" className="h-12 w-auto" />
        </header>

        <FlagBanner flaggedAt={flaggedAt} t={t} />

        <div className="flex flex-wrap gap-1.5">
          <SellerTypeBadge type={store.seller_type} t={t} />
          <VerificationBadge level={store.verification_level} t={t} />
          {years && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">{t("store.years", { n: years })}</span>}
          <EarnedBadges codes={badges} t={t} />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">{t("sheet.location")}</dt><dd className="font-medium">{where || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t("sheet.member_since")}</dt><dd className="font-medium">{new Date(store.created_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}</dd></div>
          {store.year_started && <div><dt className="text-xs text-muted-foreground">{t("store.year_started")}</dt><dd className="font-medium">{store.year_started}</dd></div>}
          {store.contact_phone && <div><dt className="text-xs text-muted-foreground">{t("store.contact_phone")}</dt><dd className="font-medium">{store.contact_phone}</dd></div>}
          {store.facebook_url && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t("store.facebook")}</dt><dd className="break-all font-medium">{store.facebook_url}</dd></div>}
        </dl>
        {store.description && <p className="whitespace-pre-line text-sm">{store.description}</p>}

        <StoreTrustCard trust={trust} t={t} />

        {reviews.length > 0 && (
          <section aria-labelledby="sr">
            <h2 id="sr" className="mb-2 font-bold text-brand-dark">{t("reviews.title")}</h2>
            <ReviewList reviews={reviews} t={t} />
          </section>
        )}

        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          <p>{t("sheet.verify_at", { url: `marketplaceph.com/store/${store.slug}` })}</p>
          <p className="mt-1">{t("sheet.disclaimer")}</p>
          <p className="mt-1">{t("sheet.generated", { date: new Date().toLocaleDateString("en-PH") })}</p>
        </footer>
      </article>
    </div>
  );
}
