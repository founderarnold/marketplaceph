import { Globe, MapPin, MessageCircle, Phone, Share2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { startConversation } from "@/app/actions/engage";
import { SignInButton } from "@/components/auth/auth-modal";
import { SellerTypeBadge, VerificationBadge } from "@/components/listing/badges";
import { ListingGrid } from "@/components/listing/listing-card";
import { loadProfileLinks, ProfileLinks } from "@/components/social/profile-links";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/images";
import { FEATURE_MIN_RANK } from "@/lib/plans";
import { createClient, createPublicClient } from "@/lib/supabase/server";

async function getSiteMeta(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`store-${slug}`);
  const { data } = await createPublicClient().from("stores").select("name, tagline, description, logo_url").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/site/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSiteMeta(slug);
  if (!s) return { title: "Store not found" };
  const description = s.tagline ?? s.description?.slice(0, 160) ?? undefined;
  const image = s.logo_url ? imageUrl(s.logo_url, "store-assets") : "/brand/logo-wordmark.webp";
  return { title: { absolute: s.name }, description, openGraph: { title: s.name, description, images: [{ url: image }] } };
}

/** A store's standalone Mini Website (paid tiers): no marketplace menus, just the business, its products and how to reach it. */
export default function MiniSite(props: PageProps<"/site/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Site params={props.params} />
    </Suspense>
  );
}

async function Site({ params }: Pick<PageProps<"/site/[slug]">, "params">) {
  const { slug } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select(
      `id, owner_id, slug, name, tagline, description, logo_url, seller_type, verification_level, contact_phone, facebook_url, website_url, address_note,
       psgc_cities ( name ), psgc_provinces ( name ), psgc_regions ( short_name )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!store) notFound();

  // Only paid members get a Mini Website; anyone else's link falls back to the normal store page.
  const { data: enabled } = await supabase.rpc("store_has_tier", { p_store: store.id, p_min: FEATURE_MIN_RANK.mini_site });
  if (!enabled) redirect(`/store/${store.slug}`);

  const [{ data: listings }, { data: claims }, ownerLinks] = await Promise.all([
    supabase.from("listings").select(LISTING_CARD_SELECT).eq("store_id", store.id).eq("status", "active").order("created_at", { ascending: false }).limit(60).overrideTypes<ListingCardData[], { merge: false }>(),
    supabase.auth.getClaims(),
    loadProfileLinks(supabase, store.owner_id),
  ]);
  const userId = (claims?.claims?.sub as string | undefined) ?? null;
  const where = [store.address_note, store.psgc_cities?.name, store.psgc_provinces?.name, store.psgc_regions?.short_name].filter(Boolean).join(", ");
  const tel = store.contact_phone?.replace(/[^\d+]/g, "");
  const messageBtn = "inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-bold text-brand-dark hover:bg-[#ea6a0c]";

  return (
    <div className="space-y-8">
      {userId === store.owner_id && (
        <p className="rounded-xl bg-accent-soft p-3 text-center text-sm text-accent-strong">
          {t("site.owner_note")} <Link href="/sell/website" className="font-bold underline">{t("site.owner_manage")}</Link>
        </p>
      )}

      <header className="-mx-4 -mt-4 bg-gradient-to-br from-brand-dark via-brand to-brand-sky px-4 pb-10 pt-8 text-center text-white md:pt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={store.logo_url ? imageUrl(store.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" width={112} height={112} className="mx-auto h-28 w-28 rounded-3xl border-4 border-white/80 bg-white object-contain shadow-lg" />
        <h1 className="mt-4 text-3xl font-extrabold md:text-5xl">{store.name}</h1>
        {store.tagline && <p className="mx-auto mt-2 max-w-2xl text-base text-white/90 md:text-lg">{store.tagline}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <SellerTypeBadge type={store.seller_type} t={t} />
          <VerificationBadge level={store.verification_level} t={t} />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {userId && userId !== store.owner_id ? (
            <form action={startConversation.bind(null, store.id, null)}>
              <button className={messageBtn}><MessageCircle size={20} aria-hidden /> {t("site.message")}</button>
            </form>
          ) : !userId ? (
            <SignInButton className={messageBtn}><MessageCircle size={20} aria-hidden /> {t("site.message")}</SignInButton>
          ) : null}
          {tel && (
            <a href={`tel:${tel}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-bold text-brand-dark hover:bg-accent-soft">
              <Phone size={20} aria-hidden /> {t("site.call")}
            </a>
          )}
        </div>
      </header>

      {store.description && (
        <section aria-labelledby="about-h" className="mx-auto max-w-3xl">
          <h2 id="about-h" className="mb-2 text-xl font-extrabold text-brand-dark">{t("site.about")}</h2>
          <p className="whitespace-pre-line text-base leading-relaxed">{store.description}</p>
        </section>
      )}

      <section aria-labelledby="products-h">
        <h2 id="products-h" className="mb-3 text-xl font-extrabold text-brand-dark">{t("site.products")} ({listings?.length ?? 0})</h2>
        <ListingGrid items={listings ?? []} t={t} />
      </section>

      <section aria-labelledby="contact-h" className="rounded-3xl border border-border bg-white p-5">
        <h2 id="contact-h" className="mb-3 text-xl font-extrabold text-brand-dark">{t("site.contact")}</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {where && <li className="flex items-center gap-2"><MapPin size={18} className="shrink-0 text-brand" aria-hidden /> {where}</li>}
          {tel && <li className="flex items-center gap-2"><Phone size={18} className="shrink-0 text-brand" aria-hidden /> <a href={`tel:${tel}`} className="font-semibold text-brand underline">{store.contact_phone}</a></li>}
          {store.facebook_url && <li className="flex items-center gap-2"><Share2 size={18} className="shrink-0 text-brand" aria-hidden /> <a href={store.facebook_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">Facebook</a></li>}
          {store.website_url && <li className="flex items-center gap-2"><Globe size={18} className="shrink-0 text-brand" aria-hidden /> <a href={store.website_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">{t("store.website")}</a></li>}
        </ul>
        <ProfileLinks links={ownerLinks} t={t} className="mt-3" />
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">
          <ShieldCheck size={16} className="shrink-0" aria-hidden /> {t("site.safety")}
        </p>
      </section>

      <footer className="pb-4 text-center text-xs text-muted-foreground">
        <Link href={`/store/${store.slug}`} className="hover:underline">{t("site.powered")}</Link>
      </footer>
    </div>
  );
}
