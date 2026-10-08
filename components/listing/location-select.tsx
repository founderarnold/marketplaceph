"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Select } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";

type Value = { region?: string | null; province?: string | null; city?: string | null };

/** Region → Province → City cascade. Emits plain <select name="region|province|city"> for form posts. */
export function LocationSelect({
  locations,
  defaultValue,
  required,
  names = { region: "region", province: "province", city: "city" },
  onChange,
}: {
  locations: Locations;
  defaultValue?: Value;
  required?: boolean;
  names?: { region: string; province: string; city: string };
  /** Called whenever the selection changes (used for shipping suggestions). */
  onChange?: (v: { region: string; province: string; city: string }) => void;
}) {
  const { t } = useT();
  const [region, setRegion] = useState(defaultValue?.region ?? "");
  const [province, setProvince] = useState(defaultValue?.province ?? "");
  const [city, setCity] = useState(defaultValue?.city ?? "");

  useEffect(() => {
    onChange?.({ region, province, city });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify only when the selection changes, not when the callback identity does
  }, [region, province, city]);

  const provinces = useMemo(() => locations.provinces.filter((p) => p.region_code === region), [locations, region]);
  // Province is optional: without one, show every city/municipality in the region.
  const cities = useMemo(
    () => locations.cities.filter((c) => (province ? c.province_code === province : c.region_code === region)),
    [locations, region, province],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t("loc.region")}>
        <Select
          name={names.region}
          value={region}
          required={required}
          onChange={(e) => {
            setRegion(e.target.value);
            setProvince("");
            setCity("");
          }}
        >
          <option value="">{t("loc.any")}</option>
          {locations.regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("loc.province")}>
        <Select
          name={names.province}
          value={province}
          disabled={!region || provinces.length === 0}
          onChange={(e) => {
            setProvince(e.target.value);
            setCity("");
          }}
        >
          <option value="">{t("loc.any")}</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("loc.city")}>
        <Select
          name={names.city}
          value={city}
          required={required}
          disabled={!region}
          onChange={(e) => {
            setCity(e.target.value);
            // picking a city implies its province, so listings keep a complete address
            const picked = locations.cities.find((c) => c.code === e.target.value);
            if (picked?.province_code) setProvince(picked.province_code);
          }}
        >
          <option value="">{t("loc.any")}</option>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
