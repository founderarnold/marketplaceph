"use client";

import { Plus, Trash2 } from "lucide-react";
import { CategoryOptions } from "@/components/listing/category-options";
import { LISTING_CONDITIONS } from "@/lib/categories";
import { useState, useTransition } from "react";
import { createListing, updateListing, type ListingInput } from "@/app/actions/sell";
import { LocationSelect } from "@/components/listing/location-select";
import { ImageUploader } from "@/components/sell/image-uploader";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Category, Locations } from "@/lib/data";
import { STOCK_STATUSES, type PriceType } from "@/lib/domain";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Tier = { min_qty: string; unit_price: string };

/** An existing listing, when the form is used to edit instead of post. */
export type ListingInitial = Omit<ListingInput, "tiers" | "description"> & { id: string; description: string | null; tiers: { min_qty: number; unit_price: number }[] };
const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function ListingForm({
  userId,
  categories,
  locations,
  storeLocation,
  initial,
}: {
  userId: string;
  categories: Category[];
  locations: Locations;
  storeLocation: { region: string | null; province: string | null; city: string | null };
  initial?: ListingInitial;
}) {
  const { t, locale } = useT();
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [priceType, setPriceType] = useState<PriceType>(initial?.price_type ?? "fixed");
  const [tiers, setTiers] = useState<Tier[]>(initial?.tiers.map((r) => ({ min_qty: String(r.min_qty), unit_price: String(r.unit_price) })) ?? []);
  const [stock, setStock] = useState<string>(initial?.stock_status ?? "in_stock");
  const str = (v: number | null | undefined) => (v == null ? undefined : String(v));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // onSubmit (not a form action): a form action resets every field on submit, so a failed post would wipe what the seller typed.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (images.length === 0) return setError(t("sell.need_photo"));
    const fd = new FormData(e.currentTarget);
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
      const res = initial ? await updateListing(initial.id, input) : await createListing(input); // both redirect to the listing on success
      if (res?.error) setError(res.error === "invalid" ? t("sell.invalid") : res.error === "limit" ? t("sell.limit") : res.error === "plan_limit" ? t("sell.plan_limit") : res.error.includes("cannot be listed") ? res.error : t("common.error"));
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-border bg-white p-5 md:p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{initial ? t("sell.edit_title") : t("sell.title")}</h1>
        <p className="text-sm text-muted-foreground">{initial ? t("sell.edit_subtitle") : t("sell.subtitle")}</p>
      </div>

      <Field label={t("sell.photos")}>
        <ImageUploader userId={userId} value={images} onChange={setImages} />
      </Field>

      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t("sell.kind")}</legend>
        {(["product", "service"] as const).map((k, i) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-dark">
            <input type="radio" name="kind" value={k} defaultChecked={initial ? initial.kind === k : i === 0} className="sr-only" />
            {t(`sell.kind.${k}`)}
          </label>
        ))}
      </fieldset>

      <Field label={t("sell.name")}>
        <Input name="title" required minLength={3} maxLength={120} placeholder={t("sell.name_ph")} defaultValue={initial?.title} />
      </Field>

      <Field label={t("sell.category")}>
        <Select name="category_id" required defaultValue={initial?.category_id ?? ""}>
          <option value="" disabled>
            —
          </option>
          <CategoryOptions categories={categories} locale={locale} valueOf="id" majorLabel={(n) => t("cat.general_in", { name: n })} />
        </Select>
      </Field>

      <Field label={t("cond.label")} hint={t("cond.hint")}>
        <Select name="condition" defaultValue={initial?.condition ?? "new"}>
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
              <Input name="price_min" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="₱" defaultValue={str(initial?.price_min)} />
            </Field>
            {priceType === "range" && (
              <Field label={t("sell.price_to")}>
                <Input name="price_max" type="number" inputMode="decimal" min={0} step="0.01" required placeholder="₱" defaultValue={str(initial?.price_max)} />
              </Field>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("sell.unit")} hint={t("sell.unit_hint")}>
            <Input name="unit" required defaultValue={initial?.unit ?? "pc"} maxLength={20} />
          </Field>
          <Field label={t("listing.moq")} hint={t("sell.moq_hint")}>
            <Input name="moq" type="number" inputMode="numeric" min={1} defaultValue={initial?.moq ?? 1} required />
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
            <Input name="quantity_on_hand" type="number" inputMode="numeric" min={0} defaultValue={str(initial?.quantity_on_hand)} />
          </Field>
        )}
      </div>

      <LocationSelect
        locations={locations}
        required
        defaultValue={initial ? { region: initial.region_code, province: initial.province_code ?? null, city: initial.city_code } : { region: storeLocation.region, province: storeLocation.province, city: storeLocation.city }}
      />

      <Field label={t("sell.description")} hint={t("store.optional")}>
        <Textarea name="description" maxLength={5000} placeholder={t("sell.description_ph")} defaultValue={initial?.description ?? undefined} />
      </Field>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>
        {pending ? t("sell.posting") : initial ? t("sell.save_changes") : t("sell.post")}
      </Button>
      {!initial && <p className="text-center text-xs text-muted-foreground">{t("sell.free_note")}</p>}
    </form>
  );
}
