import { MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { startConversation } from "@/app/actions/engage";
import { SellerTypeBadge, StockBadge, VerificationBadge } from "@/components/listing/badges";
import { EarnedBadges, FlagBanner, Stars } from "@/components/trust/trust-ui";
import { loadStoreTrust } from "@/lib/trust";
import { AddToCart } from "@/components/cart/add-to-cart";
import { FavoriteButton, ReportButton, ShareButton, ViewPing } from "@/components/listing/engage-buttons";
import { Button, buttonClass } from "@/components/ui/button";
import { formatPeso, priceLabel, yearsInBusinessBadge } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { firstImage, imageUrl } from "@/lib/images";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { z } from "zod";
import { AffiliatePanel } from "@/components/affiliates/affiliate-panel";

async function getListingMeta(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`listing-${id}`);
  const { data } = await createPublicClient()
    .from("listings")
    .select("title, description, price_type, price_min, price_max, unit, listing_images(path, position), stores(name)")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/listing/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Listing" };
  const l = await getListingMeta(id);
  if (!l) return { title: "Listing not found" };
  const price = l.price_type === "message" || l.price_min == null ? "Message for price" : formatPeso(l.price_min);
  const description = `${price} · ${l.stores?.name ?? ""}${l.description ? " — " + l.description.slice(0, 140) : ""}`;
  const image = firstImage(l.listing_images);
  return {
    title: l.title,
    description,
    openGraph: { title: l.title, description, type: "website", images: [{ url: image }] },
    twitter: { card: "summary_large_image", title: l.title, description, images: [image] },
  };
}

export default function ListingPage(props: PageProps<"/listing/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <ListingDetail params={props.params} />
    </Suspense>
  );
}

async function ListingDetail({ params }: Pick<PageProps<"/listing/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const { data: l } = await supabase
    .from("listings")
    .select(
      `id, title, description, kind, price_type, price_min, price_max, unit, moq, stock_status, quantity_on_hand, status, created_at, view_count,
       stores!inner ( id, slug, name, logo_url, seller_type, verification_level, year_started, created_at, owner_id ),
       listing_images ( path, position ),
       listing_price_tiers ( min_qty, unit_price ),
       commission_pct,
       categories ( slug, name_en, name_fil ),
       psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!l) notFound();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const store = l.stores;
  const isOwner = userId === store.owner_id;
  let isFav = false;
  let storeFav = false;
  if (userId) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id, store_id")
      .eq("user_id", userId)
      .or(`listing_id.eq.${l.id},store_id.eq.${store.id}`);
    isFav = !!favs?.some((f) => f.listing_id === l.id);
    storeFav = !!favs?.some((f) => f.store_id === store.id);
  }

  const { trust, badges, flaggedAt } = await loadStoreTrust(supabase, store.id);
  const [{ data: listShip }, { data: storeShip }] = await Promise.all([
    supabase.from("listing_shipping_methods").select("shipping_methods ( name, kind )").eq("listing_id", l.id),
    supabase.from("store_shipping_methods").select("shipping_methods ( name, kind )").eq("store_id", store.id),
  ]);
  const shipOptions = ((listShip?.length ? listShip : storeShip) ?? []).flatMap((r) => (r.shipping_methods ? [r.shipping_methods] : []));
  const images = [...l.listing_images].sort((a, b) => a.position - b.position);
  const tiers = [...l.listing_price_tiers].sort((a, b) => a.min_qty - b.min_qty);
  const years = yearsInBusinessBadge(store.year_started);
  const where = [l.psgc_cities?.name, l.psgc_provinces?.name, l.psgc_regions?.short_name].filter(Boolean).join(", ");
  const catName = l.categories ? (locale === "fil" ? l.categories.name_fil : l.categories.name_en) : null;

  return (
    <article className="grid gap-6 md:grid-cols-2">
      <ViewPing listingId={l.id} />
      <div>
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl" aria-label="Photos">
          {(images.length ? images : [{ path: "", position: 0 }]).map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={imageUrl(img.path || null)}
              alt={`${l.title} ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-square w-full shrink-0 snap-center rounded-2xl bg-muted object-cover"
            />
          ))}
        </div>
        {images.length > 1 && <p className="mt-1 text-center text-xs text-muted-foreground">{t("listing.swipe")}</p>}
      </div>

      <div className="space-y-4">
        <FlagBanner flaggedAt={flaggedAt} t={t} />
        {l.status !== "active" && (
          <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">
            {l.status === "removed" ? t("listing.removed") : t("listing.hidden")}
          </p>
        )}
        <div>
          <p className="text-3xl font-extrabold text-brand-dark">{priceLabel(l, t)}</p>
          <h1 className="mt-1 text-xl font-bold">{l.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin size={14} aria-hidden /> {where || "—"}
            {catName && <span> · {catName}</span>}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StockBadge status={l.stock_status} qty={l.quantity_on_hand} t={t} />
          {l.kind === "service" && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{t("listing.service")}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("listing.unit")}</dt>
            <dd className="font-semibold">{l.unit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("listing.moq")}</dt>
            <dd className="font-semibold">
              {l.moq} {l.unit}
            </dd>
          </div>
        </dl>

        {tiers.length > 0 && (
          <section aria-labelledby="tiers">
            <h2 id="tiers" className="mb-2 font-bold text-brand-dark">
              {t("listing.wholesale")}
            </h2>
            <table className="w-full overflow-hidden rounded-xl border border-border text-sm">
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.min_qty} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {tier.min_qty}+ {l.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{formatPeso(tier.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {!isOwner && l.status === "active" && l.stock_status !== "out_of_stock" && (
          <AddToCart listingId={l.id} storeId={store.id} moq={l.moq} unit={l.unit} />
        )}
        {shipOptions.length > 0 && (
          <section aria-labelledby="ship-h">
            <h2 id="ship-h" className="mb-1 font-bold text-brand-dark">{t("listing.ships_via")}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {shipOptions.map((m) => <li key={m.name} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{m.name}</li>)}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">{t("listing.ships_hint")}</p>
          </section>
        )}
        {isOwner ? (
          <Link href="/my/listings" className={buttonClass("outline", "lg", "w-full")}>
            {t("listing.manage")}
          </Link>
        ) : (
          <form action={startConversation.bind(null, store.id, l.id)}>
            <Button variant="accent" size="lg" className="w-full" disabled={l.status !== "active"}>
              <MessageCircle size={20} aria-hidden /> {t("listing.message_seller")}
            </Button>
          </form>
        )}

        <div className="flex gap-2">
          <FavoriteButton listingId={l.id} initialSaved={isFav} label />
          <ShareButton title={l.title} />
        </div>

        {l.commission_pct != null && l.status === "active" && <AffiliatePanel listingId={l.id} pct={Number(l.commission_pct)} userId={userId} isOwner={isOwner} />}

        {l.description && (
          <section aria-labelledby="desc">
            <h2 id="desc" className="mb-1 font-bold text-brand-dark">
              {t("listing.description")}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{l.description}</p>
          </section>
        )}

        <section className="rounded-2xl border border-border p-4" aria-labelledby="seller">
          <h2 id="seller" className="sr-only">
            {t("listing.seller")}
          </h2>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={store.logo_url ? imageUrl(store.logo_url, "store-assets") : "/brand/logo-mark.webp"}
              alt=""
              className="h-14 w-14 rounded-full border border-border bg-white object-contain"
            />
            <div className="min-w-0 flex-1">
              <Link href={`/store/${store.slug}`} className="block truncate font-bold text-brand-dark hover:underline">
                {store.name}
              </Link>
              <div className="mt-1 flex flex-wrap gap-1">
                <SellerTypeBadge type={store.seller_type} t={t} />
                <VerificationBadge level={store.verification_level} t={t} />
                {years && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">{t("store.years", { n: years })}</span>}
                <EarnedBadges codes={badges} t={t} />
              </div>
              {trust && (trust.completed_orders > 0 || trust.review_count > 0) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {trust.avg_rating != null && (
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      {Number(trust.avg_rating).toFixed(1)} <Stars value={Number(trust.avg_rating)} size={12} />
                    </span>
                  )}
                  <span>{t("trust.completed_n", { n: trust.completed_orders })}</span>
                  <span>{t("trust.sold_range", { range: trust.amount_label })}</span>
                </p>
              )}
            </div>
            <FavoriteButton storeId={store.id} initialSaved={storeFav} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("store.member_since", { date: new Date(store.created_at).toLocaleDateString("en-PH", { month: "short", year: "numeric" }) })}
          </p>
        </section>

        <div className="space-y-2 border-t border-border pt-3">
          <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("safety.tip")}</p>
          {!isOwner && <ReportButton targetType="listing" targetId={l.id} userId={userId} />}
        </div>
      </div>
    </article>
  );
}
