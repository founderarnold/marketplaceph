"use client";

import { Plus, Trash2 } from "lucide-react";
import { CategoryOptions } from "@/components/listing/category-options";
import { LISTING_CONDITIONS } from "@/lib/categories";
import { useState, useTransition } from "react";
import { createListing, type ListingInput } from "@/app/actions/sell";
import { LocationSelect } from "@/components/listing/location-select";
import { ImageUploader } from "@/components/sell/image-uploader";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Category, Locations } from "@/lib/data";
import { STOCK_STATUSES, type PriceType } from "@/lib/domain";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Tier = { min_qty: string; unit_price: string };
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ListingForm({
  userId,
  categories,
  locations,
  storeLocation,
}: {
  userId: string;
  categories: Category[];
  locations: Locations;
  storeLocation: { region: string | null; province: string | null; city: string | null };
}) {
  const { t, locale } = useT();
  const [images, setImages] = useState<string[]>([]);
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [stock, setStock] = useState<string>("in_stock");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    if (images.length === 0) return setError(t("sell.need_photo"));
    const input: ListingInput = {
      kind: fd.get("kind") as "product" | "service",
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      category_id: String(fd.get("category_id") ?? ""),
      price_type: priceType,
      price_min: priceType === "message" ? null : num(String(fd.get("price_min") ?? "")),
      price_max: priceType === "range" ? num(String(fd.get("price_max") ?? "")) : null,
      unit: String(fd.get("unit") ?? "pc"),
      moq: Number(fd.get("moq") || 1),
      stock_status: stock as ListingInput["stock_status"],
      condition: String(fd.get("condition") ?? "new") as ListingInput["condition"],
      quantity_on_hand: stock === "in_stock" ? num(String(fd.get("quantity_on_hand") ?? "")) : null,
      region_code: String(fd.get("region") ?? ""),
      province_code: String(fd.get("province") ?? "") || null,
      city_code: String(fd.get("city") ?? ""),
      images,
      tiers: tiers
        .filter((r) => r.min_qty && r.unit_price)
        .map((r) => ({ min_qty: Number(r.min_qty), unit_price: Number(r.unit_price) })),
    };
    start(async () => {
      const res = await createListing(input); // redirects to the new listing on success
      if (res?.error) setError(res.error === "invalid" ? t("sell.invalid") : res.error === "limit" ? t("sell.limit") : res.error === "plan_limit" ? t("sell.plan_limit") : res.error.includes("cannot be listed") ? res.error : t("common.error"));
    });
  }

  return (
    <form action={submit} className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-border bg-white p-5 md:p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("sell.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("sell.subtitle")}</p>
      </div>

      <Field label={t("sell.photos")}>
        <ImageUploader userId={userId} value={images} onChange={setImages} />
      </Field>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t("sell.kind")}</legend>
        {(["product", "service"] as const).map((k, i) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-dark">
            <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />
            {t(`sell.kind.${k}`)}
          </label>
        ))}
      </fieldset>

      <Field label={t("sell.name")}>
        <Input name="title" required minLength={3} maxLength={120} placeholder={t("sell.name_ph")} />
      </Field>

      <Field label={t("sell.category")}>
        <Select name="category_id" required defaultValue="">
          <option value="" disabled>
            —
          </option>
          <CategoryOptions categories={categories} locale={locale} valueOf="id" majorLabel={(n) => t("cat.general_in", { name: n })} />
        </Select>
      </Field>

      <Field label={t("cond.label")} hint={t("cond.hint")}>
        <Select name="condition" defaultValue="new">
          {LISTING_CONDITIONS.map((c) => <option key={c} value={c}>{t(`cond.${c}`)}</option>)}
        </Select>
      </Field>

      <div className="space-y-3 rounded-2xl bg-muted p-4">
        <p className="text-sm font-semibold text-brand-dark">{t("sell.price")}</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {(["fixed", "range", "message"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priceType === p}
              onClick={() => setPriceType(p)}
              className={cn(
                "min-h-11 rounded-xl border px-2 text-sm font-semibold",
                priceType === p ? "border-brand bg-white text-brand-dark" : "border-transparent bg-white/60 text-muted-foreground",
              )}
            >
              {t(`sell.price.${p}`)}
            </button>
          ))}
        </div>
        {priceType !== "message" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={priceType === "range" ? t("sell.price_from") : t("sell.price_amount")}>
              <Input name="price_min" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="₱" />
            </Field>
            {priceType === "range" && (
              <Field label={t("sell.price_to")}>
                <Input name="price_max" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="₱" />
              </Field>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("sell.unit")} hint={t("sell.unit_hint")}>
            <Input name="unit" required defaultValue="pc" maxLength={20} />
          </Field>
          <Field label={t("listing.moq")} hint={t("sell.moq_hint")}>
            <Input name="moq" type="number" inputMode="numeric" min={1} defaultValue={1} required />
          </Field>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-muted p-4">
        <p className="text-sm font-semibold text-brand-dark">{t("sell.tiers")}</p>
        <p className="text-xs text-muted-foreground">{t("sell.tiers_hint")}</p>
        {tiers.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field label={t("sell.tier_qty")} className="flex-1">
              <Input type="number" inputMode="numeric" min={2} value={row.min_qty} onChange={(e) => setTiers(tiers.map((r, j) => (j === i ? { ...r, min_qty: e.target.value } : r)))} />
            </Field>
            <Field label={t("sell.tier_price")} className="flex-1">
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={row.unit_price} onChange={(e) => setTiers(tiers.map((r, j) => (j === i ? { ...r, unit_price: e.target.value } : r)))} />
            </Field>
            <button type="button" aria-label={t("upload.remove")} onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-xl text-danger hover:bg-danger-soft">
              <Trash2 size={18} aria-hidden />
            </button>
          </div>
        ))}
        {tiers.length < 5 && (
          <button type="button" onClick={() => setTiers([...tiers, { min_qty: "", unit_price: "" }])} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
            <Plus size={16} aria-hidden /> {t("sell.add_tier")}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("sell.stock")}>
          <Select value={stock} onChange={(e) => setStock(e.target.value)}>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`stock.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        {stock === "in_stock" && (
          <Field label={t("sell.qty")} hint={t("sell.qty_hint")}>
            <Input name="quantity_on_hand" type="number" inputMode="numeric" min={0} />
          </Field>
        )}
      </div>

      <LocationSelect
        locations={locations}
        required
        defaultValue={{ region: storeLocation.region, province: storeLocation.province, city: storeLocation.city }}
      />

      <Field label={t("sell.description")} hint={t("store.optional")}>
        <Textarea name="description" maxLength={5000} placeholder={t("sell.description_ph")} />
      </Field>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
        {pending ? t("sell.posting") : t("sell.post")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("sell.free_note")}</p>
    </form>
  );
}
