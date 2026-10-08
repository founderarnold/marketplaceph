import { Calendar, FileText, Globe, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerTypeBadge, VerificationBadge } from "@/components/listing/badges";
import { FavoriteButton, ReportButton, ShareButton } from "@/components/listing/engage-buttons";
import { ListingGrid } from "@/components/listing/listing-card";
import { EarnedBadges, FlagBanner, ReviewList, StoreTrustCard } from "@/components/trust/trust-ui";
import { loadReviews, loadStoreTrust } from "@/lib/trust";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";
import { yearsInBusinessBadge } from "@/lib/format";
import { FEATURE_MIN_RANK } from "@/lib/plans";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/images";
import { createClient, createPublicClient } from "@/lib/supabase/server";

async function getStoreMeta(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-${slug}`);
  const { data } = await createPublicClient().from("stores").select("name, tagline, description, logo_url").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = await getStoreMeta(slug);
  if (!s) return { title: "Store not found" };
  const description = s.tagline ?? s.description?.slice(0, 160) ?? "Shop on MarketplacePH";
  const image = s.logo_url ? imageUrl(s.logo_url, "store-assets") : "/brand/logo-wordmark.webp";
  return {
    title: s.name,
    description,
    openGraph: { title: s.name, description, images: [{ url: image }] },
    twitter: { card: "summary", title: s.name, description, images: [image] },
  };
}

export default function StorePage(props: PageProps<"/store/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Storefront params={props.params} />
    </Suspense>
  );
}

async function Storefront({ params }: Pick<PageProps<"/store/[slug]">, "params">) {
  const { slug } = await params;
  const { t } = await getT();
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select(
      `id, owner_id, slug, name, tagline, description, logo_url, seller_type, verification_level, year_started, created_at,
       contact_phone, facebook_url, website_url, address_note, psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!store) notFound();

  const { data: listings } = await supabase
    .from("listings")
    .select(LISTING_CARD_SELECT)
    .eq("store_id", store.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .overrideTypes<ListingCardData[], { merge: false }>();

  const [{ data: featured }, { trust, badges, flaggedAt }, reviews] = await Promise.all([
    supabase.rpc("store_has_tier", { p_store: store.id, p_min: FEATURE_MIN_RANK.featured }),
    loadStoreTrust(supabase, store.id),
    loadReviews(supabase, { storeId: store.id, direction: "buyer_to_seller" }, 10),
  ]);

  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  let saved = false;
  if (userId) {
    const { data } = await supabase.from("favorites").select("id").eq("user_id", userId).eq("store_id", store.id).maybeSingle();
    saved = !!data;
  }

  const all = listings ?? [];
  const inStock = all.filter((l) => l.stock_status !== "out_of_stock");
  const out = all.filter((l) => l.stock_status === "out_of_stock");
  const years = yearsInBusinessBadge(store.year_started);
  const where = [store.psgc_cities?.name, store.psgc_provinces?.name, store.psgc_regions?.short_name].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <FlagBanner flaggedAt={flaggedAt} t={t} />
      <header className="rounded-3xl border border-border bg-white p-5">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={store.logo_url ? imageUrl(store.logo_url, "store-assets") : "/brand/logo-mark.webp"}
            alt=""
            className="h-20 w-20 shrink-0 rounded-2xl border border-border bg-white object-contain"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-brand-dark">{store.name}</h1>
            {store.tagline && <p className="text-sm text-muted-foreground">{store.tagline}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SellerTypeBadge type={store.seller_type} t={t} />
              <VerificationBadge level={store.verification_level} t={t} />
              {years && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">{t("store.years", { n: years })}</span>}
              {featured && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">★ {t("store.featured")}</span>}
              <EarnedBadges codes={badges} t={t} />
            </div>
          </div>
        </div>

        <ul className="mt-4 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <MapPin size={16} aria-hidden /> {where || "—"}
          </li>
          <li className="flex items-center gap-2">
            <Calendar size={16} aria-hidden />
            {t("store.member_since", { date: new Date(store.created_at).toLocaleDateString("en-PH", { month: "short", year: "numeric" }) })}
          </li>
          {store.contact_phone && (
            <li className="flex items-center gap-2">
              <Phone size={16} aria-hidden /> {store.contact_phone}
            </li>
          )}
          {store.website_url && (
            <li className="flex items-center gap-2">
              <Globe size={16} aria-hidden />
              <a href={store.website_url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                {t("store.website")}
              </a>
            </li>
          )}
          {store.facebook_url && (
            <li className="flex items-center gap-2">
              <Globe size={16} aria-hidden />
              <a href={store.facebook_url} rel="noopener noreferrer nofollow" target="_blank" className="underline">
                {t("store.facebook")}
              </a>
            </li>
          )}
        </ul>
        {store.description && <p className="mt-3 whitespace-pre-line text-sm">{store.description}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {userId !== store.owner_id && <FavoriteButton storeId={store.id} initialSaved={saved} label />}
          <ShareButton title={store.name} />
          <Link href={`/store/${store.slug}/sheet`} className="btn inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 font-semibold">
            <FileText size={20} aria-hidden /> {t("sheet.open")}
          </Link>
        </div>
        <p className="mt-3 rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("store.trust_note")}</p>
      </header>

      <StoreTrustCard trust={trust} t={t} />

      <section aria-labelledby="instock">
        <h2 id="instock" className="mb-3 text-lg font-bold text-brand-dark">
          {t("store.in_stock")} ({inStock.length})
        </h2>
        <ListingGrid items={inStock} t={t} />
      </section>

      {out.length > 0 && (
        <section aria-labelledby="out">
          <h2 id="out" className="mb-3 text-lg font-bold text-muted-foreground">
            {t("store.out_of_stock")} ({out.length})
          </h2>
          <ListingGrid items={out} t={t} />
        </section>
      )}

      <section aria-labelledby="revs">
        <h2 id="revs" className="mb-3 text-lg font-bold text-brand-dark">
          {t("reviews.title")}
        </h2>
        <ReviewList reviews={reviews} t={t} />
      </section>

      {userId !== store.owner_id && <ReportButton targetType="store" targetId={store.id} userId={userId} />}
    </div>
  );
}
