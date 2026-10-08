import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CheckoutForm, type MethodOption } from "@/components/cart/checkout-form";
import { buttonClass } from "@/components/ui/button";
import { getLocations } from "@/lib/data";
import { formatPeso } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { unitPriceFor } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage(props: PageProps<"/checkout/[storeId]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Checkout params={props.params} />
    </Suspense>
  );
}

async function Checkout({ params }: Pick<PageProps<"/checkout/[storeId]">, "params">) {
  const { storeId } = await params;
  if (!z.uuid().safeParse(storeId).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const [{ data: store }, { data: cart }, locations, { data: profile }] = await Promise.all([
    supabase.from("stores").select("id, slug, name, owner_id, region_code, province_code, city_code").eq("id", storeId).maybeSingle(),
    supabase
      .from("cart_items")
      .select("id, quantity, listings!inner ( id, title, unit, price_type, price_min, weight_kg, store_id, listing_price_tiers ( min_qty, unit_price ) )")
      .eq("user_id", me),
    getLocations(),
    supabase.from("profiles").select("display_name, phone").eq("id", me).single(),
  ]);
  if (!store) notFound();
  const rows = (cart ?? []).filter((c) => c.listings.store_id === storeId);
  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-muted p-8 text-center">
        <p>{t("cart.empty")}</p>
        <Link href={`/store/${store.slug}`} className={buttonClass("primary")}>{t("home.cta_browse")}</Link>
      </div>
    );
  }

  const { data: methodRows } = await supabase.from("shipping_methods").select("id, name, kind, owner_id").eq("is_active", true).order("name");
  const { data: supported } = await supabase.from("store_shipping_methods").select("method_id").eq("store_id", storeId);
  const supportedIds = new Set((supported ?? []).map((s) => s.method_id));
  const methods: MethodOption[] = (methodRows ?? [])
    // buyers may only choose built-ins, their own, or what the store supports (RLS already hides other people's custom methods)
    .filter((m) => m.owner_id === null || m.owner_id === me)
    .map((m) => ({ id: m.id, name: m.name, kind: m.kind, mine: m.owner_id === me, supported: supportedIds.has(m.id) }));

  let est = 0;
  let unpriced = false;
  let weight: number | null = 0;
  let qty = 0;
  for (const r of rows) {
    const l = r.listings;
    const p = unitPriceFor(l, l.listing_price_tiers, r.quantity);
    if (p == null) unpriced = true;
    else est += p * r.quantity;
    qty += r.quantity;
    weight = weight != null && l.weight_kg != null ? weight + Number(l.weight_kg) * r.quantity : null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("checkout.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("checkout.intro", { store: store.name })}</p>
      </div>
      <section className="rounded-2xl border border-border bg-white p-4">
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2">
              <span className="truncate">{r.listings.title} × {r.quantity} {r.listings.unit}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-border pt-2 text-sm">
          {t("cart.subtotal")}: <b>{formatPeso(est)}</b> {unpriced && <span className="text-muted-foreground">+ {t("cart.price_pending")}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{t("cart.estimate_note")}</p>
      </section>
      <CheckoutForm
        storeId={store.id}
        storeName={store.name}
        sellerPlace={{ region: store.region_code, province: store.province_code, city: store.city_code }}
        locations={locations}
        methods={methods}
        totalQty={qty}
        totalWeightKg={weight}
        defaults={{ name: profile?.display_name && profile.display_name !== "New user" ? profile.display_name : "", phone: profile?.phone ? `0${profile.phone.replace(/^63/, "")}` : "" }}
      />
    </div>
  );
}
