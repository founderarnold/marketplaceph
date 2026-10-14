import { BadgeCheck, MapPin, Package, Truck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPeso, timeAgo } from "@/lib/format";
import type { TFunction } from "@/lib/i18n/shared";

export type RiderCardData = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  vehicle_type: string;
  vehicle_model: string | null;
  city: string | null;
  province: string | null;
  completed: number;
  nearness: number;
};

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "accent" | "danger"> = {
  open: "accent",
  assigned: "brand",
  picked_up: "brand",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
};
export function DeliveryStatusBadge({ status, t }: { status: string; t: TFunction }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{t(`dl.status.${status}`)}</Badge>;
}

/** A verified rider: first name + last initial, vehicle, area and finished deliveries. Never the phone or plate. */
export function RiderCard({ r, t, action }: { r: RiderCardData; t: TFunction; action?: React.ReactNode }) {
  const place = [r.city, r.province].filter(Boolean).join(", ");
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
      {r.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.avatar_url} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-bold text-brand">{r.name.slice(0, 1).toUpperCase()}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-bold text-brand-dark">
          {r.name}
          <Badge tone="success" title={t("badge.verified_rider.desc")}><BadgeCheck size={13} aria-hidden /> {t("badge.verified_rider")}</Badge>
        </p>
        <p className="flex items-center gap-1 text-sm text-foreground">
          <Truck size={14} className="shrink-0 text-brand" aria-hidden /> {t(`dl.vehicle.${r.vehicle_type}`)}
          {r.vehicle_model ? <span className="truncate text-muted-foreground">· {r.vehicle_model}</span> : null}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {place && <><MapPin size={12} className="shrink-0" aria-hidden /> {place} · </>}
          {t("dl.completed_n", { n: r.completed })}
          {r.nearness === 0 && <b className="text-success"> · {t("dl.near.city")}</b>}
          {r.nearness === 1 && <b className="text-brand"> · {t("dl.near.province")}</b>}
        </p>
      </div>
      {action}
    </li>
  );
}

/** Columns for a booking list item (the two city names come from the PSGC table). */
export const BOOKING_SELECT =
  "id, item_description, total_weight_kg, vehicle_type, status, created_at, offered_fee, agreed_fee, pickup:psgc_cities!delivery_requests_pickup_city_code_fkey(name), dropoff:psgc_cities!delivery_requests_dropoff_city_code_fkey(name)" as const;

export type BookingRow = {
  id: string;
  item_description: string;
  total_weight_kg: number;
  vehicle_type: string;
  status: string;
  created_at: string;
  pickup_city: string | null;
  dropoff_city: string | null;
  fee: number | null;
  invited?: boolean;
};

export function BookingCard({ b, t }: { b: BookingRow; t: TFunction }) {
  return (
    <li>
      <Link href={`/delivery/${b.id}`} className="block space-y-1 rounded-2xl border border-border bg-white p-3 hover:border-brand">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 font-bold text-brand-dark">
            <Package size={16} className="shrink-0 text-brand" aria-hidden /> <span className="truncate">{b.item_description}</span>
          </p>
          <DeliveryStatusBadge status={b.status} t={t} />
        </div>
        <p className="text-sm text-foreground">
          {b.pickup_city ?? "—"} → <b>{b.dropoff_city ?? "—"}</b>
        </p>
        <p className="text-xs text-muted-foreground">
          {Number(b.total_weight_kg).toLocaleString("en-PH")} kg · {t(`dl.vehicle.${b.vehicle_type}`)}
          {b.fee != null && <> · <b className="text-foreground">{formatPeso(Number(b.fee))}</b></>} · {timeAgo(b.created_at)}
          {b.invited && <b className="text-accent-strong"> · {t("dl.you_were_asked")}</b>}
        </p>
      </Link>
    </li>
  );
}
