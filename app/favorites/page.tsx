import type { Metadata } from "next";
import Link from "next/link";
import { SellerTypeBadge, VerificationBadge } from "@/components/listing/badges";
import { ListingGrid } from "@/components/listing/listing-card";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/domain";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved" };

export default async function FavoritesPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: favs } = await supabase.from("favorites").select("listing_id, store_id").eq("user_id", me).order("created_at", { ascending: false });
  const listingIds = (favs ?? []).flatMap((f) => (f.listing_id ? [f.listing_id] : []));
  const storeIds = (favs ?? []).flatMap((f) => (f.store_id ? [f.store_id] : []));

  const [{ data: listings }, { data: stores }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select(LISTING_CARD_SELECT).in("id", listingIds).eq("status", "active").overrideTypes<ListingCardData[], { merge: false }>()
      : Promise.resolve({ data: [] as ListingCardData[] }),
    storeIds.length
      ? supabase.from("stores").select("id, slug, name, logo_url, seller_type, verification_level").in("id", storeIds)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-8">
      <section aria-labelledby="fl">
        <h1 id="fl" className="mb-3 text-2xl font-extrabold text-brand-dark">
          {t("fav.saved_items")}
        </h1>
        {(listings ?? []).length ? <ListingGrid items={listings ?? []} t={t} /> : <p className="rounded-2xl bg-muted p-6 text-center text-muted-foreground">{t("fav.empty_items")}</p>}
      </section>
      <section aria-labelledby="fs">
        <h2 id="fs" className="mb-3 text-xl font-bold text-brand-dark">
          {t("fav.saved_sellers")}
        </h2>
        {(stores ?? []).length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {(stores ?? []).map((s) => (
              <li key={s.id}>
                <Link href={`/store/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3 hover:bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.logo_url ? imageUrl(s.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" className="h-12 w-12 rounded-full border border-border bg-white object-contain" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <SellerTypeBadge type={s.seller_type} t={t} />
                      <VerificationBadge level={s.verification_level} t={t} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-muted p-6 text-center text-muted-foreground">{t("fav.empty_sellers")}</p>
        )}
      </section>
    </div>
  );
}
