"use client";

import { useActionState } from "react";
import { createStore } from "@/app/actions/sell";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { SELLER_TYPES } from "@/lib/domain";
import { useT } from "@/lib/i18n/client";

export function StoreSetupForm({ locations }: { locations: Locations }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(createStore, undefined);
  const v = state?.values ?? {};

  return (
    <form action={action} className="mx-auto max-w-xl space-y-4 rounded-3xl border border-border bg-white p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("store.setup_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("store.setup_sub")}</p>
      </div>
      <Field label={t("store.name")}>
        <Input name="name" required minLength={2} maxLength={80} placeholder={t("store.name_ph")} defaultValue={v.name} />
      </Field>
      <Field label={t("store.type")} hint={t("store.type_hint")}>
        <Select name="seller_type" required defaultValue={v.seller_type ?? ""}>
          <option value="" disabled>
            —
          </option>
          {SELLER_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`seller.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <LocationSelect
        locations={locations}
        required
        defaultValue={{ region: v.region_code, province: v.province_code, city: v.city_code }}
        names={{ region: "region_code", province: "province_code", city: "city_code" }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("store.year_started")} hint={t("store.optional")}>
          <Input name="year_started" type="number" inputMode="numeric" min={1900} max={2100} placeholder="2018" defaultValue={v.year_started} />
        </Field>
        <Field label={t("store.contact_phone")} hint={t("store.contact_phone_hint")}>
          <Input name="contact_phone" type="tel" inputMode="tel" maxLength={20} defaultValue={v.contact_phone} />
        </Field>
      </div>
      <Field label={t("store.tagline")} hint={t("store.optional")}>
        <Input name="tagline" maxLength={160} defaultValue={v.tagline} />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {t("common.error")}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("store.create")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("store.verify_note")}</p>
    </form>
  );
}
