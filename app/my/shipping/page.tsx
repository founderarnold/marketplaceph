import type { Metadata } from "next";
import Link from "next/link";
import { CustomMethodForm, ListingShippingPicker, MyMethodList, PaymentMethods, StoreShippingPicker, type Method } from "@/components/settings/shipping-settings";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shipping & payment settings" };

export default async function ShippingSettingsPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const [{ data: ms }, { data: store }] = await Promise.all([
    supabase.from("shipping_methods").select("id, name, kind, owner_id, notes").eq("is_active", true).order("name"),
    supabase.from("stores").select("id, name").eq("owner_id", me).limit(1).maybeSingle(),
  ]);
  // your options: the built-in list plus the ones you added yourself
  const methods: Method[] = (ms ?? []).filter((m) => m.owner_id === null || m.owner_id === me).map((m) => ({ id: m.id, name: m.name, kind: m.kind, mine: m.owner_id === me, notes: m.notes }));
  const mine = methods.filter((m) => m.mine);

  let storeSel: string[] = [];
  let listings: { id: string; title: string; sel: string[] }[] = [];
  let pay: { id: string; kind: string; account_name: string | null; account_number: string | null; bank_name: string | null; instructions: string | null }[] = [];
  if (store) {
    const [{ data: sm }, { data: ls }, { data: pm }] = await Promise.all([
      supabase.from("store_shipping_methods").select("method_id").eq("store_id", store.id),
      supabase.from("listings").select("id, title, listing_shipping_methods ( method_id )").eq("store_id", store.id).neq("status", "removed").order("created_at", { ascending: false }).limit(60),
      supabase.from("store_payment_methods").select("id, kind, account_name, account_number, bank_name, instructions").eq("store_id", store.id).order("created_at"),
    ]);
    storeSel = (sm ?? []).map((s) => s.method_id);
    listings = (ls ?? []).map((l) => ({ id: l.id, title: l.title, sel: l.listing_shipping_methods.map((x) => x.method_id) }));
    pay = pm ?? [];
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("shipset.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("shipset.intro")}</p>
      </div>

      <section className="space-y-3" aria-labelledby="mine-h">
        <h2 id="mine-h" className="text-lg font-bold text-brand-dark">{t("shipset.my_methods")}</h2>
        <p className="text-sm text-muted-foreground">{t("shipset.my_methods_hint")}</p>
        <MyMethodList methods={mine} />
        <CustomMethodForm />
      </section>

      {store ? (
        <>
          <section className="space-y-3" aria-labelledby="store-h">
            <h2 id="store-h" className="text-lg font-bold text-brand-dark">{t("shipset.store_methods", { store: store.name })}</h2>
            <p className="text-sm text-muted-foreground">{t("shipset.store_hint")}</p>
            <StoreShippingPicker methods={methods} initial={storeSel} />
          </section>
          <section className="space-y-3" aria-labelledby="listing-h">
            <h2 id="listing-h" className="text-lg font-bold text-brand-dark">{t("shipset.per_listing")}</h2>
            {listings.length === 0 ? <p className="text-sm text-muted-foreground">{t("my.empty")}</p> : (
              <div className="space-y-2">{listings.map((l) => <ListingShippingPicker key={l.id} listingId={l.id} title={l.title} methods={methods} initial={l.sel} />)}</div>
            )}
          </section>
          <section className="space-y-3" aria-labelledby="pay-h">
            <h2 id="pay-h" className="text-lg font-bold text-brand-dark">{t("shipset.payments")}</h2>
            <PaymentMethods rows={pay} />
          </section>
        </>
      ) : (
        <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">
          {t("shipset.no_store")} <Link href="/sell/new" className="font-semibold text-brand underline">{t("nav.post_free")}</Link>
        </p>
      )}
    </div>
  );
}
