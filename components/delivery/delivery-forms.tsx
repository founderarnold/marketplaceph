"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  acceptDeliveryOffer,
  createBooking,
  getRiderDocUrl,
  inviteRider,
  reviewRider,
  sendDeliveryOffer,
  setDeliveryStatus,
  setRiderAvailable,
  submitRiderApplication,
  withdrawDeliveryOffer,
  type DlResult,
} from "@/app/actions/delivery";
import { LocationSelect } from "@/components/listing/location-select";
import { PrivateFileInput, type UploadedFile } from "@/components/trust/private-files";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { RIDER_DOCS, suggestVehicle, VEHICLES, type VehicleKey } from "@/lib/delivery";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

function useRun() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<DlResult>, okText?: string, after?: () => void) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) {
        const known = ["invalid", "bad_phone", "need_city", "need_area", "bad_plate", "need_docs", "already_offered", "auth"];
        return setMsg({ ok: false, text: res.error && known.includes(res.error) ? t(`dl.err.${res.error}`) : res.error && res.error !== "failed" ? res.error : t("common.error") });
      }
      if (okText) setMsg({ ok: true, text: okText });
      after?.();
      router.refresh();
    });
  const note = msg && <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl p-3 text-sm font-medium", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{msg.text}</p>;
  return { pending, run, note };
}

const section = "space-y-3 rounded-3xl border border-border bg-white p-5 md:p-6";
const h2 = "flex items-center gap-2 text-lg font-extrabold text-brand-dark";
const step = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white";

export type BookingDefaults = {
  order_id?: string;
  item_description?: string;
  quantity?: number;
  declared_value?: number;
  pickup?: { name?: string; phone?: string; address?: string; region?: string | null; province?: string | null; city?: string | null };
  dropoff?: { name?: string; phone?: string; address?: string; region?: string | null; province?: string | null; city?: string | null };
};

/** Booking form: parcel, vehicle, pickup and drop-off. Uses onSubmit so a failed booking keeps what was typed. */
export function BookingForm({ locations, defaults = {} }: { locations: Locations; defaults?: BookingDefaults }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const [qty, setQty] = useState(String(defaults.quantity ?? 1));
  const [perPiece, setPerPiece] = useState("");
  const [total, setTotal] = useState("");
  const [totalTouched, setTotalTouched] = useState(false);
  const [vehicle, setVehicle] = useState<"any" | VehicleKey>("any");

  const autoTotal = Number(qty) > 0 && Number(perPiece) > 0 ? +(Number(qty) * Number(perPiece)).toFixed(2) : null;
  const totalKg = totalTouched ? Number(total) : (autoTotal ?? 0);
  const limit = VEHICLES.find((v) => v.key === vehicle)?.maxKg;
  const tooHeavy = vehicle !== "any" && limit != null && totalKg > limit;

  const place = (kind: "pickup" | "dropoff") => {
    const d = defaults[kind] ?? {};
    return (
      <section className={section}>
        <h2 className={h2}><span className={step}>{kind === "pickup" ? 3 : 4}</span>{t(`dl.${kind}_title`)}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("dl.contact_name")}><Input name={`${kind}_name`} required minLength={2} maxLength={80} defaultValue={d.name} autoComplete="off" /></Field>
          <Field label={t("dl.contact_phone")} hint={t("dl.phone_hint")}><Input name={`${kind}_phone`} required type="tel" inputMode="tel" maxLength={20} defaultValue={d.phone} placeholder="0917 123 4567" /></Field>
        </div>
        <LocationSelect locations={locations} required defaultValue={{ region: d.region, province: d.province, city: d.city }} names={{ region: `${kind}_region_code`, province: `${kind}_province_code`, city: `${kind}_city_code` }} />
        <Field label={t("dl.address")} hint={t("dl.address_hint")}>
          <Textarea name={`${kind}_address`} required minLength={5} maxLength={300} rows={2} defaultValue={d.address} className="min-h-16" placeholder={t("dl.address_ph")} />
        </Field>
        <Field label={t("dl.landmark")} hint={t("store.optional")}>
          <Input name={`${kind}_landmark`} maxLength={200} placeholder={t("dl.landmark_ph")} />
        </Field>
      </section>
    );
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("vehicle_type", vehicle);
        if (!totalTouched && autoTotal != null) fd.set("total_weight_kg", String(autoTotal));
        run(() => createBooking(fd));
      }}
    >
      {defaults.order_id && <input type="hidden" name="order_id" value={defaults.order_id} />}
      <section className={section}>
        <h2 className={h2}><span className={step}>1</span>{t("dl.parcel_title")}</h2>
        <Field label={t("dl.item")} hint={t("dl.item_hint")}>
          <Input name="item_description" required minLength={3} maxLength={200} defaultValue={defaults.item_description} placeholder={t("dl.item_ph")} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("dl.quantity")}><Input name="quantity" type="number" inputMode="numeric" required min={1} max={100000} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
          <Field label={t("dl.weight_piece")}><Input name="weight_per_piece_kg" type="number" inputMode="decimal" required min={0.01} max={5000} step="0.01" value={perPiece} onChange={(e) => setPerPiece(e.target.value)} placeholder="0.5" /></Field>
          <Field label={t("dl.weight_total")} hint={!totalTouched && autoTotal != null ? t("dl.auto_total") : undefined} className="col-span-2 sm:col-span-1">
            <Input
              name="total_weight_kg"
              type="number"
              inputMode="decimal"
              required
              min={0.01}
              max={50000}
              step="0.01"
              value={totalTouched ? total : (autoTotal ?? "")}
              onChange={(e) => {
                setTotalTouched(true);
                setTotal(e.target.value);
              }}
            />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-brand-dark">{t("dl.size")} <span className="font-normal text-muted-foreground">({t("store.optional")})</span></p>
          <div className="grid grid-cols-3 gap-2">
            {(["length_cm", "width_cm", "height_cm"] as const).map((k) => (
              <Input key={k} name={k} type="number" inputMode="decimal" min={0.1} max={2000} step="0.1" aria-label={t(`dl.${k}`)} placeholder={t(`dl.${k}`)} />
            ))}
          </div>
        </div>
        <Field label={t("dl.declared_value")} hint={t("dl.declared_hint")}>
          <Input name="declared_value" type="number" inputMode="decimal" required min={0} max={100000000} step="0.01" defaultValue={defaults.declared_value} placeholder="₱" />
        </Field>
      </section>

      <section className={section}>
        <h2 className={h2}><span className={step}>2</span>{t("dl.vehicle_title")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("dl.vehicle_title")}>
          {(["any", ...VEHICLES.map((v) => v.key)] as const).map((k) => {
            const max = VEHICLES.find((v) => v.key === k)?.maxKg;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={vehicle === k}
                onClick={() => setVehicle(k)}
                className={cn("min-h-16 rounded-xl border px-2 py-2 text-left text-sm", vehicle === k ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-border hover:bg-muted")}
              >
                <span className="block font-bold text-brand-dark">{t(`dl.vehicle.${k}`)}</span>
                <span className="block text-xs text-muted-foreground">{max ? t("dl.up_to_kg", { n: max.toLocaleString("en-PH") }) : t("dl.any_hint")}</span>
              </button>
            );
          })}
        </div>
        {tooHeavy && (
          <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm font-medium text-accent-strong">
            {t("dl.too_heavy", { vehicle: t(`dl.vehicle.${suggestVehicle(totalKg)}`) })}
          </p>
        )}
      </section>

      {place("pickup")}
      {place("dropoff")}

      <section className={section}>
        <h2 className={h2}><span className={step}>5</span>{t("dl.when_title")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("dl.pickup_at")} hint={t("dl.pickup_at_hint")}><Input name="pickup_at" type="datetime-local" /></Field>
          <Field label={t("dl.offered_fee")} hint={t("dl.offered_fee_hint")}><Input name="offered_fee" type="number" inputMode="decimal" min={0} max={1000000} step="1" placeholder="₱" /></Field>
        </div>
        <Field label={t("dl.notes")} hint={t("store.optional")}>
          <Textarea name="notes" maxLength={1000} rows={3} placeholder={t("dl.notes_ph")} />
        </Field>
      </section>

      {note}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>{t("dl.book")}</Button>
      <p className="text-center text-xs text-muted-foreground">{t("dl.book_note")}</p>
    </form>
  );
}

/** Rider sends a fee for a booking. */
export function DeliveryOfferForm({ requestId, suggested }: { requestId: string; suggested: number | null }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("request_id", requestId);
        run(() => sendDeliveryOffer(fd), t("dl.offer_sent"));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("dl.your_fee")}><Input name="fee" type="number" inputMode="decimal" required min={0} max={1000000} step="1" defaultValue={suggested ?? undefined} placeholder="₱" /></Field>
        <Field label={t("dl.eta")} hint={t("store.optional")}><Input name="pickup_eta_minutes" type="number" inputMode="numeric" min={0} max={10080} placeholder="30" /></Field>
      </div>
      <Field label={t("dl.offer_message")} hint={t("store.optional")}>
        <Textarea name="message" maxLength={500} rows={2} className="min-h-16" placeholder={t("dl.offer_message_ph")} />
      </Field>
      {note}
      <Button type="submit" disabled={pending}>{t("dl.send_offer")}</Button>
      <p className="text-xs text-muted-foreground">{t("dl.offer_private")}</p>
    </form>
  );
}

export function AcceptDeliveryOffer({ offerId, requestId }: { offerId: string; requestId: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-2">
      <Button size="sm" disabled={pending} onClick={() => confirm(t("dl.confirm_hire")) && run(() => acceptDeliveryOffer(offerId, requestId))}>{t("dl.hire")}</Button>
      {note}
    </div>
  );
}

export function WithdrawDeliveryOffer({ offerId, requestId }: { offerId: string; requestId: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(t("dl.confirm_withdraw")) && run(() => withdrawDeliveryOffer(offerId, requestId))}>{t("dl.withdraw")}</Button>
      {note}
    </div>
  );
}

export function InviteRiderButton({ requestId, riderId, invited }: { requestId: string; riderId: string; invited: boolean }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const [done, setDone] = useState(invited);
  if (done) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 size={14} aria-hidden /> {t("dl.asked")}</span>;
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => inviteRider(requestId, riderId), undefined, () => setDone(true))}>{t("dl.ask_rider")}</Button>
      {note}
    </div>
  );
}

/** The next step buttons for whoever is looking: rider (picked up / delivered / give back) or the person who booked. */
export function DeliveryStepButtons({ id, status, role }: { id: string; status: string; role: "rider" | "requester" }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const btns: { s: Parameters<typeof setDeliveryStatus>[1]; label: string; confirm?: string; variant?: "primary" | "outline" | "ghost" }[] = [];
  if (role === "rider" && status === "assigned") {
    btns.push({ s: "picked_up", label: t("dl.mark_picked_up") });
    btns.push({ s: "released", label: t("dl.release"), confirm: t("dl.confirm_release"), variant: "ghost" });
  }
  if (role === "rider" && status === "picked_up") btns.push({ s: "delivered", label: t("dl.mark_delivered"), confirm: t("dl.confirm_delivered") });
  if (role === "requester" && status === "delivered") btns.push({ s: "completed", label: t("dl.mark_received") });
  if (role === "requester" && (status === "open" || status === "assigned")) btns.push({ s: "cancelled", label: t("dl.cancel"), confirm: t("dl.confirm_cancel"), variant: "ghost" });
  if (!btns.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {btns.map((b) => (
          <Button key={b.s} variant={b.variant ?? "primary"} disabled={pending} className={b.s === "cancelled" ? "text-danger" : undefined} onClick={() => (!b.confirm || confirm(b.confirm)) && run(() => setDeliveryStatus(id, b.s))}>
            {b.label}
          </Button>
        ))}
      </div>
      {note}
    </div>
  );
}

export type RiderCurrent = {
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_model: string | null;
  plate_number: string;
  license_number: string;
  license_expiry: string;
  region_code: string;
  province_code: string | null;
  city_code: string | null;
  about: string | null;
};

/** Register as a rider: details + the five required photos (private, only admins can open them). */
export function RiderForm({ userId, locations, current, defaultName }: { userId: string; locations: Locations; current: RiderCurrent | null; defaultName: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const [docs, setDocs] = useState<Record<string, UploadedFile[]>>({});
  const [vehicle, setVehicle] = useState(current?.vehicle_type ?? "motorcycle");
  const missing = RIDER_DOCS.filter((d) => !docs[d]?.length);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("vehicle_type", vehicle);
        const list = Object.entries(docs).flatMap(([type, files]) => files.map((f) => ({ type, path: f.path })));
        run(() => submitRiderApplication(fd, list), t("dl.reg_sent"), () => window.scrollTo({ top: 0, behavior: "smooth" }));
      }}
    >
      <section className={section}>
        <h2 className={h2}><span className={step}>1</span>{t("dl.reg_you")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("dl.full_name")} hint={t("dl.full_name_hint")}><Input name="full_name" required minLength={3} maxLength={80} defaultValue={current?.full_name ?? defaultName} autoComplete="name" /></Field>
          <Field label={t("dl.mobile")} hint={t("dl.mobile_hint")}><Input name="phone" required type="tel" inputMode="tel" maxLength={20} defaultValue={current?.phone} placeholder="0917 123 4567" autoComplete="tel" /></Field>
          <Field label={t("dl.license_no")}><Input name="license_number" required minLength={5} maxLength={20} defaultValue={current?.license_number} placeholder="N01-23-456789" className="uppercase" /></Field>
          <Field label={t("dl.license_expiry")}><Input name="license_expiry" type="date" required defaultValue={current?.license_expiry} /></Field>
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-brand-dark">{t("dl.service_area")}</p>
          <LocationSelect locations={locations} required defaultValue={{ region: current?.region_code, province: current?.province_code, city: current?.city_code }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
          <p className="mt-1 text-xs text-muted-foreground">{t("dl.service_area_hint")}</p>
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}><span className={step}>2</span>{t("dl.reg_vehicle")}</h2>
        <Field label={t("dl.vehicle_type")}>
          <Select value={vehicle} onChange={(e) => setVehicle(e.target.value)} required>
            {VEHICLES.map((v) => <option key={v.key} value={v.key}>{t(`dl.vehicle.${v.key}`)}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("dl.plate")} hint={t("dl.plate_hint")}><Input name="plate_number" required maxLength={11} defaultValue={current?.plate_number} placeholder="ABC 1234" className="uppercase" /></Field>
          <Field label={t("dl.vehicle_model")} hint={t("store.optional")}><Input name="vehicle_model" maxLength={60} defaultValue={current?.vehicle_model ?? ""} placeholder={t("dl.vehicle_model_ph")} /></Field>
        </div>
        <Field label={t("dl.about")} hint={t("store.optional")}>
          <Textarea name="about" maxLength={500} rows={2} className="min-h-16" defaultValue={current?.about ?? ""} placeholder={t("dl.about_ph")} />
        </Field>
      </section>

      <section className={section}>
        <h2 className={h2}><span className={step}>3</span>{t("dl.reg_docs")}</h2>
        <p className="text-sm text-muted-foreground">{t("dl.reg_docs_intro")}</p>
        <ul className="space-y-3">
          {[...RIDER_DOCS, "other" as const].map((d) => (
            <li key={d} className="rounded-2xl bg-muted/60 p-3">
              <p className="text-sm font-bold text-brand-dark">
                {t(`dl.doc.${d}`)} {d === "other" && <span className="font-normal text-muted-foreground">({t("store.optional")})</span>}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">{t(`dl.doc.${d}.hint`)}</p>
              <PrivateFileInput userId={userId} bucket="private-docs" value={docs[d] ?? []} onChange={(files) => setDocs((s) => ({ ...s, [d]: files }))} max={d === "or_cr" || d === "other" ? 3 : 1} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("dl.docs_private")}</p>
      </section>

      {note}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending || missing.length > 0}>
        {missing.length ? t("dl.docs_missing", { n: missing.length }) : t("dl.reg_submit")}
      </Button>
    </form>
  );
}

export function AvailabilityToggle({ on }: { on: boolean }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-2">
      <Button variant={on ? "outline" : "primary"} disabled={pending} onClick={() => run(() => setRiderAvailable(!on))}>
        {on ? t("dl.go_offline") : t("dl.go_online")}
      </Button>
      {note}
    </div>
  );
}

/* ───────── Admin ───────── */

export function RiderDocButton({ id, label }: { id: string; label: string }) {
  const { t } = useT();
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(false);
            const res = await getRiderDocUrl(id);
            if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
            else setErr(true);
          })
        }
        className="inline-flex min-h-10 items-center rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-brand-dark hover:bg-muted disabled:opacity-60"
      >
        {label}
      </button>
      {err && <span role="alert" className="text-xs text-danger">{t("common.error")}</span>}
    </span>
  );
}

export function RiderReviewForm({ userId, status }: { userId: string; status: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const [decision, setDecision] = useState<"approved" | "needs_more" | "rejected" | "suspended">(status === "approved" ? "suspended" : "approved");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("decision", decision);
        run(() => reviewRider(userId, fd), t("dl.admin.saved"));
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {(["approved", "needs_more", "rejected", "suspended"] as const).map((d) => (
          <button key={d} type="button" aria-pressed={decision === d} onClick={() => setDecision(d)} className={cn("min-h-9 rounded-lg border px-3 text-xs font-bold", decision === d ? "border-brand bg-brand text-white" : "border-border bg-white hover:bg-muted")}>
            {t(`dl.admin.do.${d}`)}
          </button>
        ))}
      </div>
      <Textarea name="note" maxLength={500} rows={2} className="min-h-14 text-sm" placeholder={t("dl.admin.note_ph")} required={decision !== "approved"} />
      {note}
      <Button size="sm" type="submit" disabled={pending}>{t("dl.admin.save")}</Button>
    </form>
  );
}
