import type { Metadata } from "next";
import Link from "next/link";
import { CartQty } from "@/components/cart/cart-row";
import { buttonClass } from "@/components/ui/button";
import { formatPeso } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { firstThumb } from "@/lib/images";
import { unitPriceFor } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: items } = await supabase
    .from("cart_items")
    .select(
      `id, quantity, listings!inner ( id, title, unit, moq, price_type, price_min, stock_status, status,
         stores!inner ( id, name, slug ), listing_images ( path, position ), listing_price_tiers ( min_qty, unit_price ) )`,
    )
    .eq("user_id", me)
    .order("created_at", { ascending: false });

  const groups = new Map<string, { store: { id: string; name: string; slug: string }; rows: NonNullable<typeof items> }>();
  for (const it of items ?? []) {
    const s = it.listings.stores;
    if (!groups.has(s.id)) groups.set(s.id, { store: s, rows: [] });
    groups.get(s.id)!.rows.push(it);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("cart.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cart.intro")}</p>
      </div>
      {groups.size === 0 && (
        <div className="space-y-3 rounded-2xl bg-muted p-8 text-center">
          <p className="text-muted-foreground">{t("cart.empty")}</p>
          <Link href="/search" className={buttonClass("primary")}>{t("home.cta_browse")}</Link>
        </div>
      )}
      {[...groups.values()].map(({ store, rows }) => {
        let subtotal = 0;
        let unpriced = false;
        return (
          <section key={store.id} aria-label={store.name} className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <h2 className="font-bold text-brand-dark">
              <Link href={`/store/${store.slug}`} className="hover:underline">{store.name}</Link>
            </h2>
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const l = r.listings;
                const price = unitPriceFor(l, l.listing_price_tiers, r.quantity);
                if (price == null) unpriced = true;
                else subtotal += price * r.quantity;
                const unavailable = l.stock_status === "out_of_stock" || l.status !== "active";
                return (
                  <li key={r.id} className="flex gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={firstThumb(l.listing_images)} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl bg-muted object-cover" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Link href={`/listing/${l.id}`} className="block truncate font-semibold hover:underline">{l.title}</Link>
                      <p className="text-sm text-muted-foreground">
                        {price != null ? `${formatPeso(price)} / ${l.unit}` : t("cart.price_pending")}
                        {l.moq > 1 && ` · ${t("listing.moq")} ${l.moq}`}
                      </p>
                      {unavailable && <p className="text-sm font-semibold text-danger">{t("cart.unavailable")}</p>}
                      <CartQty itemId={r.id} quantity={r.quantity} moq={l.moq} />
                    </div>
                    <p className="shrink-0 font-bold text-brand-dark">{price != null ? formatPeso(price * r.quantity) : "—"}</p>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-sm">
                {t("cart.subtotal")}: <b>{formatPeso(subtotal)}</b> {unpriced && <span className="text-muted-foreground">+ {t("cart.price_pending")}</span>}
                <span className="block text-xs text-muted-foreground">{t("cart.estimate_note")}</span>
              </p>
              <Link href={`/checkout/${store.id}`} className={buttonClass("accent", "lg")}>{t("cart.checkout")}</Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}
