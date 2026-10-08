import type { Metadata } from "next";
import Link from "next/link";
import { MyListingRow, type MyListing } from "@/components/sell/my-listing-row";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My listings" };

export default async function MyListingsPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string;

  const { data: store } = await supabase.from("stores").select("id, slug, name").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-muted p-8 text-center">
        <p>{t("my.no_store")}</p>
        <Link href="/sell/new" className={buttonClass("accent", "lg")}>
          {t("nav.post_free")}
        </Link>
      </div>
    );
  }

  const { data } = await supabase
    .from("listings")
    .select("id, title, price_type, price_min, price_max, unit, stock_status, quantity_on_hand, status, view_count, commission_pct, listing_images(path, position)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const { data: usage } = await supabase.rpc("listing_usage");
  const used = usage?.[0]?.used ?? 0;
  const cap = usage?.[0]?.listing_limit ?? null;

  const rows: MyListing[] = (data ?? []).map((l) => ({
    ...l,
    image: [...l.listing_images].sort((a, b) => a.position - b.position)[0]?.path ?? null,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark">{t("my.title")}</h1>
          <Link href={`/store/${store.slug}`} className="text-sm font-semibold text-brand hover:underline">
            {t("my.view_store")}: {store.name}
          </Link>
        </div>
        <Link href="/sell/new" className={buttonClass("accent")}>
          {t("nav.post_free")}
        </Link>
      </div>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
        {cap ? t("plan.usage_listings", { used, limit: cap }) : t("plan.usage_listings_unlimited", { used })}
        {cap && used >= cap - 2 && (
          <>
            {" "}
            <Link href="/business/plan" className="font-semibold underline">{t("plan.upgrade")}</Link>
          </>
        )}
        {" · "}
        <Link href="/my/store" className="font-semibold underline">{t("store.edit_link")}</Link>
      </p>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("my.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <MyListingRow key={l.id} l={l} />
          ))}
        </ul>
      )}
    </div>
  );
}
