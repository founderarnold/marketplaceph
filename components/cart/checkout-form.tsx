"use client";

import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { placeOrder } from "@/app/actions/orders";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { recommendShipping, type Place, type ShippingKind } from "@/lib/shipping";
import { cn } from "@/lib/utils";

export type MethodOption = { id: string; name: string; kind: ShippingKind; mine: boolean; supported: boolean };

export function CheckoutForm({
  storeId, storeName, sellerPlace, locations, methods, totalQty, totalWeightKg, defaults,
}: {
  storeId: string;
  storeName: string;
  sellerPlace: Place;
  locations: Locations;
  methods: MethodOption[];
  totalQty: number;
  totalWeightKg: number | null;
  defaults: { name: string; phone: string };
}) {
  const { t } = useT();
  const router = useRouter();
  const [place, setPlace] = useState<Place>({});
  const [urgent, setUrgent] = useState(false);
  const [preferred, setPreferred] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const recs = useMemo(
    () => recommendShipping({ seller: sellerPlace, buyer: place, totalWeightKg, totalQty, urgent }),
    [sellerPlace, place, totalWeightKg, totalQty, urgent],
  );
  const recKinds = new Set(recs.map((r) => r.kind));
  const grouped = {
    supported: methods.filter((m) => m.supported),
    mine: methods.filter((m) => m.mine && !m.supported),
    other: methods.filter((m) => !m.mine && !m.supported),
  };

  function submit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await placeOrder({
        storeId,
        urgency: urgent ? "urgent" : "standard",
        preferredMethodId: preferred || null,
        note: String(fd.get("note") ?? ""),
        delivery: {
          recipient_name: String(fd.get("recipient_name") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          address: String(fd.get("address") ?? ""),
          landmark: String(fd.get("landmark") ?? ""),
          region_code: String(fd.get("region_code") ?? ""),
          province_code: String(fd.get("province_code") ?? ""),
          city_code: String(fd.get("city_code") ?? ""),
        },
      });
      if (!res.ok) return setError(res.error === "empty_cart" ? t("cart.empty") : res.error && res.error !== "failed" && res.error !== "invalid" ? res.error : t("common.error"));
      router.push(`/orders/${res.id}`);
    });
  }

  const Option = ({ m }: { m: MethodOption }) => (
    <option value={m.id}>
      {m.name} · {t(`ship.kind.${m.kind}`)}{recKinds.has(m.kind) ? " ★" : ""}
    </option>
  );

  return (
    <form action={submit} className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
        <h2 className="font-bold text-brand-dark">{t("checkout.delivery")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("checkout.recipient")}><Input name="recipient_name" required minLength={2} maxLength={80} defaultValue={defaults.name} autoComplete="name" /></Field>
          <Field label={t("checkout.phone")}><Input name="phone" type="tel" inputMode="tel" required maxLength={20} defaultValue={defaults.phone} autoComplete="tel" /></Field>
        </div>
        <LocationSelect
          locations={locations}
          required
          names={{ region: "region_code", province: "province_code", city: "city_code" }}
          onChange={(v) => setPlace({ region: v.region, province: v.province, city: v.city })}
        />
        <Field label={t("checkout.address")} hint={t("checkout.address_hint")}><Textarea name="address" required minLength={5} maxLength={300} className="min-h-20" /></Field>
        <Field label={t("checkout.landmark")} hint={t("store.optional")}><Input name="landmark" maxLength={200} /></Field>
        <p className="text-xs text-muted-foreground">{t("checkout.privacy")}</p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-white p-4">
        <h2 className="font-bold text-brand-dark">{t("checkout.shipping")}</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
          {t("checkout.urgent")}
        </label>

        <div className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
          <p className="mb-1 flex items-center gap-1.5 font-bold"><Lightbulb size={16} aria-hidden /> {t("ship.recommended")}</p>
          {!place.region ? (
            <p>{t("ship.pick_location")}</p>
          ) : (
            <ul className="space-y-1">
              {recs.map((r, i) => (
                <li key={r.kind} className={cn(i === 0 && "font-semibold")}>
                  {i === 0 ? "★ " : "• "}{t(`ship.kind.${r.kind}`)} <span className="font-normal text-muted-foreground">— {t(`ship.why.${r.reason}`)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t("ship.rule_note")}</p>
        </div>

        <Field label={t("checkout.preferred")} hint={t("checkout.preferred_hint", { store: storeName })}>
          <Select value={preferred} onChange={(e) => setPreferred(e.target.value)}>
            <option value="">{t("checkout.no_pref")}</option>
            {grouped.mine.length > 0 && <optgroup label={t("ship.group_mine")}>{grouped.mine.map((m) => <Option key={m.id} m={m} />)}</optgroup>}
            {grouped.supported.length > 0 && <optgroup label={t("ship.group_store", { store: storeName })}>{grouped.supported.map((m) => <Option key={m.id} m={m} />)}</optgroup>}
            {grouped.other.length > 0 && <optgroup label={t("ship.group_other")}>{grouped.other.map((m) => <Option key={m.id} m={m} />)}</optgroup>}
          </Select>
        </Field>
        <p className="text-sm">
          {t("checkout.own_courier")} <Link href="/my/shipping" className="font-semibold text-brand underline">{t("checkout.add_courier")}</Link>
        </p>
        <Field label={t("checkout.note")} hint={t("store.optional")}><Textarea name="note" maxLength={500} className="min-h-20" placeholder={t("checkout.note_ph")} /></Field>
      </section>

      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>{t("checkout.send")}</Button>
      <p className="text-center text-xs text-muted-foreground">{t("checkout.no_charge")}</p>
    </form>
  );
}
