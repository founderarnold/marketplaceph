import { BadgeCheck, Bike, PackageCheck, Plus, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BOOKING_SELECT, BookingCard, RiderCard, type BookingRow } from "@/components/delivery/delivery-cards";
import { AvailabilityToggle } from "@/components/delivery/delivery-forms";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Button, buttonClass } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { getLocations } from "@/lib/data";
import { VEHICLE_KEYS } from "@/lib/delivery";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Delivery Rider: book a verified rider",
  description: "Book a verified delivery rider near you to pick up and deliver parcels between sellers and buyers, or register as a rider.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function DeliveryPage(props: PageProps<"/delivery">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Delivery searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Delivery({ searchParams }: Pick<PageProps<"/delivery">, "searchParams">) {
  const sp = await searchParams;
  const region = one(sp.region).slice(0, 20);
  const vehicle = (VEHICLE_KEYS as readonly string[]).includes(one(sp.v)) ? one(sp.v) : "";
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: claims }, locations] = await Promise.all([supabase.auth.getClaims(), getLocations()]);
  const me = (claims?.claims?.sub as string | undefined) ?? null;

  const [{ data: riders }, mine, rider] = await Promise.all([
    supabase.rpc("public_riders", { p_region: region || undefined, p_vehicle: vehicle || undefined, p_limit: 24 }),
    me ? supabase.from("delivery_requests").select(BOOKING_SELECT).eq("requester_id", me).order("created_at", { ascending: false }).limit(10) : null,
    me ? supabase.from("rider_profiles").select("status, is_available, region_code").eq("user_id", me).maybeSingle() : null,
  ]);
  const myRider = rider?.data ?? null;
  const isRider = myRider?.status === "approved";
  const [jobs, myJobs] = isRider
    ? await Promise.all([
        supabase.rpc("open_deliveries", { p_region: myRider.region_code, p_limit: 30 }),
        supabase.from("delivery_requests").select(BOOKING_SELECT).eq("rider_id", me!).in("status", ["assigned", "picked_up", "delivered"]).order("assigned_at", { ascending: false }).limit(20),
      ])
    : [null, null];

  const toRow = (b: NonNullable<NonNullable<typeof mine>["data"]>[number]): BookingRow => ({
    id: b.id, item_description: b.item_description, total_weight_kg: b.total_weight_kg, vehicle_type: b.vehicle_type, status: b.status,
    created_at: b.created_at, pickup_city: b.pickup?.name ?? null, dropoff_city: b.dropoff?.name ?? null, fee: b.agreed_fee ?? b.offered_fee,
  });
  const h2 = "flex items-center gap-2 text-lg font-extrabold text-brand-dark";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-brand-dark p-5 text-white md:p-8">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-accent"><Bike size={18} aria-hidden /> {t("nav.delivery")}</p>
        <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{t("dl.hero_title")}</h1>
        <p className="mt-2 max-w-2xl text-white/85">{t("dl.hero_sub")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/delivery/new" className={buttonClass("accent", "lg")}><Plus size={18} aria-hidden /> {t("dl.book_cta")}</Link>
          <Link href="/delivery/register" className={buttonClass("outline", "lg", "border-white/40 bg-white/10 text-white hover:bg-white/20")}>
            <BadgeCheck size={18} aria-hidden /> {myRider ? t("dl.my_rider_cta") : t("dl.register_cta")}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: PackageCheck, key: "1" },
          { icon: Truck, key: "2" },
          { icon: ShieldCheck, key: "3" },
        ].map(({ icon: Icon, key }) => (
          <div key={key} className="rounded-2xl border border-border bg-white p-4">
            <Icon size={22} className="text-brand" aria-hidden />
            <p className="mt-1 font-bold text-brand-dark">{t(`dl.how${key}_title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`dl.how${key}`)}</p>
          </div>
        ))}
      </section>

      {isRider && (
        <section id="jobs" className="scroll-mt-32 space-y-3 rounded-3xl bg-accent-soft/60 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={h2}><Truck size={20} aria-hidden /> {t("dl.jobs_title")}</h2>
            <AvailabilityToggle on={myRider.is_available} />
          </div>
          {!!myJobs?.data?.length && (
            <>
              <p className="text-sm font-bold text-brand-dark">{t("dl.my_jobs")}</p>
              <ul className="grid gap-2 md:grid-cols-2">{myJobs.data.map((b) => <BookingCard key={b.id} b={toRow(b)} t={t} />)}</ul>
            </>
          )}
          <p className="text-sm font-bold text-brand-dark">{t("dl.open_jobs")}</p>
          {jobs?.data?.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {jobs.data.map((j) => (
                <BookingCard key={j.id} t={t} b={{ id: j.id, item_description: j.item_description, total_weight_kg: j.total_weight_kg, vehicle_type: j.vehicle_type, status: j.status, created_at: j.created_at, pickup_city: j.pickup_city, dropoff_city: j.dropoff_city, fee: j.offered_fee, invited: j.invited }} />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm text-muted-foreground">{t("dl.no_jobs")}</p>
          )}
        </section>
      )}

      {me && !!mine?.data?.length && (
        <section className="space-y-3">
          <h2 className={h2}><PackageCheck size={20} aria-hidden /> {t("dl.my_bookings")}</h2>
          <ul className="grid gap-2 md:grid-cols-2">{mine.data.map((b) => <BookingCard key={b.id} b={toRow(b)} t={t} />)}</ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className={h2}><BadgeCheck size={20} aria-hidden /> {t("dl.riders_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("dl.riders_sub")}</p>
          </div>
          <form className="flex flex-wrap gap-2" action="/delivery">
            <Select name="region" defaultValue={region} aria-label={t("rq.region")} className="h-10 w-auto text-sm">
              <option value="">{t("rq.all_regions")}</option>
              {locations.regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </Select>
            <Select name="v" defaultValue={vehicle} aria-label={t("dl.vehicle_type")} className="h-10 w-auto text-sm">
              <option value="">{t("dl.vehicle.any")}</option>
              {VEHICLE_KEYS.map((k) => <option key={k} value={k}>{t(`dl.vehicle.${k}`)}</option>)}
            </Select>
            <Button type="submit" size="sm" className="h-10">{t("dl.filter")}</Button>
          </form>
        </div>
        {riders?.length ? (
          <ul className="grid gap-2 md:grid-cols-2">{riders.map((r) => <RiderCard key={r.user_id} r={r} t={t} />)}</ul>
        ) : (
          <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{t("dl.no_riders")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("dl.riders_how_hire")}</p>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5">
        <h2 className={h2}><ShieldCheck size={20} aria-hidden /> {t("dl.safety_title")}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {(["1", "2", "3", "4"] as const).map((n) => <li key={n}>{t(`dl.safety${n}`)}</li>)}
        </ul>
      </section>
    </div>
  );
}
