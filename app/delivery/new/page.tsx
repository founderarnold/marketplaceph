import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BookingForm, type BookingDefaults } from "@/components/delivery/delivery-forms";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const metadata: Metadata = { title: "Book a delivery rider" };

export default function NewBookingPage(props: PageProps<"/delivery/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewBooking searchParams={props.searchParams} />
    </Suspense>
  );
}

async function NewBooking({ searchParams }: Pick<PageProps<"/delivery/new">, "searchParams">) {
  const sp = await searchParams;
  const orderId = typeof sp.order === "string" && z.uuid().safeParse(sp.order).success ? sp.order : null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect(`/login?next=${encodeURIComponent(`/delivery/new${orderId ? `?order=${orderId}` : ""}`)}`);
  const [{ t }, locations] = await Promise.all([getT(), getLocations()]);

  // Booking for an order: the seller's store is the pickup, the buyer's delivery address is the drop-off.
  let defaults: BookingDefaults = {};
  if (orderId) {
    const { data: o } = await supabase
      .from("orders")
      .select("id, summary, quantity, amount, buyer_id, seller_id, stores(name, contact_phone, address_note, region_code, province_code, city_code)")
      .eq("id", orderId)
      .maybeSingle();
    if (o && (o.buyer_id === me || o.seller_id === me)) {
      const { data: d } = await supabase.from("order_delivery").select("recipient_name, phone, address, landmark, region_code, province_code, city_code").eq("order_id", orderId).maybeSingle();
      const s = o.stores;
      defaults = {
        order_id: o.id,
        item_description: o.summary.slice(0, 200),
        quantity: o.quantity,
        declared_value: Number(o.amount) || undefined,
        pickup: { name: s?.name, phone: s?.contact_phone ?? undefined, address: s?.address_note ?? undefined, region: s?.region_code, province: s?.province_code, city: s?.city_code },
        dropoff: d
          ? { name: d.recipient_name, phone: d.phone, address: [d.address, d.landmark].filter(Boolean).join(" · "), region: d.region_code, province: d.province_code, city: d.city_code }
          : {},
      };
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/delivery" className="text-sm font-semibold text-brand hover:underline">← {t("nav.delivery")}</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-dark">{t("dl.book_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dl.book_intro")}</p>
        {defaults.order_id && <p className="mt-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("dl.for_order", { id: defaults.order_id.slice(0, 6).toUpperCase() })}</p>}
      </div>
      <BookingForm locations={locations} defaults={defaults} />
    </div>
  );
}
