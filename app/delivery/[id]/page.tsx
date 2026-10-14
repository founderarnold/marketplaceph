import { BadgeCheck, MapPin, Package, Phone, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DeliveryStatusBadge, RiderCard, type RiderCardData } from "@/components/delivery/delivery-cards";
import { AcceptDeliveryOffer, DeliveryOfferForm, DeliveryStepButtons, InviteRiderButton, WithdrawDeliveryOffer } from "@/components/delivery/delivery-forms";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DELIVERY_STATUSES, telHref } from "@/lib/delivery";
import { formatPeso, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { z } from "zod";

export const metadata: Metadata = { title: "Delivery booking", robots: { index: false } };

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }) : null);
const card = "space-y-3 rounded-3xl border border-border bg-white p-5";
const FULL_SELECT =
  "*, pickup_city:psgc_cities!delivery_requests_pickup_city_code_fkey(name), pickup_prov:psgc_provinces!delivery_requests_pickup_province_code_fkey(name), dropoff_city:psgc_cities!delivery_requests_dropoff_city_code_fkey(name), dropoff_prov:psgc_provinces!delivery_requests_dropoff_province_code_fkey(name)" as const;

export default function DeliveryDetailPage(props: PageProps<"/delivery/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DeliveryDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function DeliveryDetail({ params, searchParams }: Pick<PageProps<"/delivery/[id]">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect(`/login?next=/delivery/${id}`);
  const { t } = await getT();

  const { data: d } = await supabase.from("delivery_requests").select(FULL_SELECT).eq("id", id).maybeSingle();

  // Other riders: only the summary (city, parcel, fee), never names, exact addresses or phone numbers.
  if (!d) {
    const { data: rows } = await supabase.rpc("open_deliveries", { p_id: id, p_limit: 1 });
    const s = rows?.[0];
    if (!s) return <NotAvailable t={t} />;
    const { data: myOffer } = await supabase.from("delivery_offers").select("id, fee, pickup_eta_minutes, message, status").eq("request_id", id).eq("rider_id", me).maybeSingle();
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/delivery#jobs" className="text-sm font-semibold text-brand hover:underline">← {t("dl.jobs_title")}</Link>
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-xl font-extrabold text-brand-dark">{s.item_description}</h1>
            <DeliveryStatusBadge status={s.status} t={t} />
          </div>
          {s.invited && <p className="rounded-xl bg-accent-soft p-2 text-sm font-semibold text-accent-strong">{t("dl.you_were_asked")}</p>}
          <Route from={[s.pickup_city, s.pickup_province]} to={[s.dropoff_city, s.dropoff_province]} t={t} />
          <Parcel p={s} t={t} />
          {s.offered_fee != null && <p className="text-sm">{t("dl.customer_budget")}: <b>{formatPeso(Number(s.offered_fee))}</b></p>}
          <p className="text-xs text-muted-foreground">{t("dl.exact_after_hire")}</p>
        </section>
        <section className={card}>
          <h2 className="font-bold text-brand-dark">{myOffer ? t("dl.your_offer") : t("dl.make_offer")}</h2>
          {myOffer ? (
            <div className="space-y-2 text-sm">
              <p><b>{formatPeso(Number(myOffer.fee))}</b>{myOffer.pickup_eta_minutes != null && <> · {t("dl.eta_n", { n: myOffer.pickup_eta_minutes })}</>} · <Badge>{t(`dl.offer_status.${myOffer.status}`)}</Badge></p>
              {myOffer.message && <p className="text-muted-foreground">{myOffer.message}</p>}
              {myOffer.status === "sent" && <WithdrawDeliveryOffer offerId={myOffer.id} requestId={id} />}
            </div>
          ) : (
            <DeliveryOfferForm requestId={id} suggested={s.offered_fee != null ? Number(s.offered_fee) : null} />
          )}
        </section>
      </div>
    );
  }

  const isRequester = d.requester_id === me;
  const isRider = d.rider_id === me;
  const hired = ["assigned", "picked_up", "delivered", "completed"].includes(d.status);

  const [{ data: offers }, { data: contact }, { data: invites }, nearby] = await Promise.all([
    isRequester ? supabase.from("delivery_offers").select("id, rider_id, fee, pickup_eta_minutes, message, status, created_at").eq("request_id", id).neq("status", "withdrawn").order("fee") : Promise.resolve({ data: null }),
    hired && !isRider ? supabase.rpc("delivery_rider_contact", { p_id: id }) : Promise.resolve({ data: null }),
    isRequester && d.status === "open" ? supabase.from("delivery_invites").select("rider_id").eq("request_id", id) : Promise.resolve({ data: null }),
    isRequester && d.status === "open"
      ? supabase.rpc("public_riders", { p_region: d.pickup_region_code, p_province: d.pickup_province_code ?? undefined, p_city: d.pickup_city_code, p_vehicle: d.vehicle_type, p_limit: 8 })
      : Promise.resolve({ data: null }),
  ]);
  const offerRiderIds = (offers ?? []).map((o) => o.rider_id);
  const { data: offerRiders } = offerRiderIds.length ? await supabase.rpc("public_riders", { p_ids: offerRiderIds, p_limit: 60 }) : { data: [] as RiderCardData[] };
  const riderById = new Map((offerRiders ?? []).map((r) => [r.user_id, r]));
  const invited = new Set((invites ?? []).map((i) => i.rider_id));
  const rc = contact?.[0];
  const stepIdx = DELIVERY_STATUSES.indexOf(d.status as (typeof DELIVERY_STATUSES)[number]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/delivery" className="text-sm font-semibold text-brand hover:underline">← {t("nav.delivery")}</Link>
      {sp.booked === "1" && <p role="status" className="rounded-2xl bg-success-soft p-3 text-sm font-medium text-success">{t("dl.booked_ok")}</p>}

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("dl.booking")} #{d.id.slice(0, 6).toUpperCase()} · {timeAgo(d.created_at)}</p>
            <h1 className="text-xl font-extrabold text-brand-dark">{d.item_description}</h1>
          </div>
          <DeliveryStatusBadge status={d.status} t={t} />
        </div>
        {d.order_id && <Link href={`/orders/${d.order_id}`} className="text-sm font-semibold text-brand hover:underline">{t("dl.for_order", { id: d.order_id.slice(0, 6).toUpperCase() })} →</Link>}
        {d.status !== "cancelled" && (
          <ol className="grid grid-cols-5 gap-1 text-center text-[11px] font-semibold" aria-label={t("order.progress")}>
            {DELIVERY_STATUSES.slice(0, 5).map((s, i) => (
              <li key={s} className={cn("rounded-lg px-1 py-1.5", i <= stepIdx ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>{t(`dl.status.${s}`)}</li>
            ))}
          </ol>
        )}
        <Parcel p={d} t={t} />
        <p className="text-sm">
          {d.agreed_fee != null ? <>{t("dl.agreed_fee")}: <b>{formatPeso(Number(d.agreed_fee))}</b></> : d.offered_fee != null ? <>{t("dl.offered_fee")}: <b>{formatPeso(Number(d.offered_fee))}</b></> : t("dl.no_fee_yet")}
          {" · "}{d.pickup_at ? t("dl.pickup_on", { date: when(d.pickup_at)! }) : t("dl.asap")}
        </p>
        {d.notes && <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{d.notes}</p>}
        {(isRequester || isRider) && <DeliveryStepButtons id={d.id} status={d.status} role={isRider ? "rider" : "requester"} />}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Stop title={t("dl.pickup_title")} name={d.pickup_name} phone={d.pickup_phone} address={d.pickup_address} landmark={d.pickup_landmark} place={[d.pickup_city?.name, d.pickup_prov?.name]} t={t} />
        <Stop title={t("dl.dropoff_title")} name={d.dropoff_name} phone={d.dropoff_phone} address={d.dropoff_address} landmark={d.dropoff_landmark} place={[d.dropoff_city?.name, d.dropoff_prov?.name]} t={t} />
      </div>

      {rc && (
        <section className={card}>
          <h2 className="flex items-center gap-2 font-bold text-brand-dark"><BadgeCheck size={18} className="text-success" aria-hidden /> {t("dl.your_rider")}</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">{t("dl.full_name")}</dt><dd className="font-semibold">{rc.full_name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("dl.mobile")}</dt><dd><a href={telHref(rc.phone)} className="font-semibold text-brand underline">{rc.phone}</a></dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("dl.vehicle_type")}</dt><dd>{t(`dl.vehicle.${rc.vehicle_type}`)}{rc.vehicle_model ? ` · ${rc.vehicle_model}` : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("dl.plate")}</dt><dd className="font-mono font-bold">{rc.plate_number}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">{t("dl.check_plate")}</p>
        </section>
      )}

      {isRequester && d.status === "open" && (
        <>
          <section className={card}>
            <h2 className="font-bold text-brand-dark">{t("dl.offers_n", { n: offers?.length ?? 0 })}</h2>
            {offers?.length ? (
              <ul className="space-y-3">
                {offers.map((o) => {
                  const r = riderById.get(o.rider_id);
                  return (
                    <li key={o.id} className="space-y-2 rounded-2xl bg-muted/60 p-3">
                      {r && <ul><RiderCard r={r} t={t} /></ul>}
                      <p className="text-sm">
                        <b className="text-lg text-brand-dark">{formatPeso(Number(o.fee))}</b>
                        {o.pickup_eta_minutes != null && <> · {t("dl.eta_n", { n: o.pickup_eta_minutes })}</>} · {timeAgo(o.created_at)}
                      </p>
                      {o.message && <p className="text-sm text-muted-foreground">{o.message}</p>}
                      {o.status === "sent" && <AcceptDeliveryOffer offerId={o.id} requestId={id} />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("dl.no_offers_yet")}</p>
            )}
          </section>
          <section className={card}>
            <h2 className="font-bold text-brand-dark">{t("dl.nearby_title")}</h2>
            <p className="text-sm text-muted-foreground">{t("dl.nearby_sub")}</p>
            {nearby.data?.length ? (
              <ul className="space-y-2">
                {nearby.data.filter((r) => r.user_id !== me).map((r) => (
                  <RiderCard key={r.user_id} r={r} t={t} action={<InviteRiderButton requestId={id} riderId={r.user_id} invited={invited.has(r.user_id)} />} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("dl.no_nearby")}</p>
            )}
          </section>
        </>
      )}

      {d.status === "delivered" && isRequester && <p className="rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">{t("dl.confirm_hint")}</p>}
      <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">{t("dl.disclaimer")}</p>
    </div>
  );
}

function NotAvailable({ t }: { t: Awaited<ReturnType<typeof getT>>["t"] }) {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-3xl border border-border bg-white p-6 text-center">
      <Package size={32} className="mx-auto text-brand" aria-hidden />
      <h1 className="text-lg font-extrabold text-brand-dark">{t("dl.not_available")}</h1>
      <p className="text-sm text-muted-foreground">{t("dl.not_available_sub")}</p>
      <Link href="/delivery" className={buttonClass("primary", "md")}>{t("nav.delivery")}</Link>
    </div>
  );
}

type TT = Awaited<ReturnType<typeof getT>>["t"];
function Route({ from, to, t }: { from: (string | null | undefined)[]; to: (string | null | undefined)[]; t: TT }) {
  const j = (a: (string | null | undefined)[]) => a.filter(Boolean).join(", ") || "—";
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm">
      <MapPin size={15} className="text-brand" aria-hidden /> <span className="sr-only">{t("dl.pickup_title")}</span>{j(from)} → <b>{j(to)}</b>
    </p>
  );
}

function Parcel({ p, t }: { p: { quantity: number; weight_per_piece_kg: number; total_weight_kg: number; length_cm: number | null; width_cm: number | null; height_cm: number | null; declared_value: number; vehicle_type: string }; t: TT }) {
  const kg = (n: number) => `${Number(n).toLocaleString("en-PH")} kg`;
  const size = p.length_cm && p.width_cm && p.height_cm ? `${p.length_cm} × ${p.width_cm} × ${p.height_cm} cm` : null;
  return (
    <dl className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-3 text-sm sm:grid-cols-3">
      <div><dt className="text-xs text-muted-foreground">{t("dl.quantity")}</dt><dd className="font-semibold">{p.quantity.toLocaleString("en-PH")}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("dl.weight_piece")}</dt><dd className="font-semibold">{kg(p.weight_per_piece_kg)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("dl.weight_total")}</dt><dd className="font-semibold">{kg(p.total_weight_kg)}</dd></div>
      {size && <div><dt className="text-xs text-muted-foreground">{t("dl.size")}</dt><dd className="font-semibold">{size}</dd></div>}
      <div><dt className="text-xs text-muted-foreground">{t("dl.declared_value")}</dt><dd className="font-semibold">{formatPeso(Number(p.declared_value))}</dd></div>
      <div><dt className="text-xs text-muted-foreground">{t("dl.vehicle_type")}</dt><dd className="flex items-center gap-1 font-semibold"><Truck size={14} className="text-brand" aria-hidden /> {t(`dl.vehicle.${p.vehicle_type}`)}</dd></div>
    </dl>
  );
}

function Stop({ title, name, phone, address, landmark, place, t }: { title: string; name: string; phone: string; address: string; landmark: string | null; place: (string | null | undefined)[]; t: TT }) {
  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 font-bold text-brand-dark"><MapPin size={18} className="text-accent" aria-hidden /> {title}</h2>
      <p className="text-sm font-semibold">{name}</p>
      <a href={telHref(phone)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-soft px-3 text-sm font-bold text-brand"><Phone size={15} aria-hidden /> {phone}</a>
      <p className="whitespace-pre-wrap text-sm">{address}</p>
      <p className="text-sm text-muted-foreground">{place.filter(Boolean).join(", ")}</p>
      {landmark && <p className="text-sm"><span className="text-muted-foreground">{t("dl.landmark")}:</span> {landmark}</p>}
    </section>
  );
}
