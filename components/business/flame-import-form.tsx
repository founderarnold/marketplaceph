"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importFlameBusiness } from "@/app/actions/flame-business";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { SELLER_TYPES } from "@/lib/domain";
import type { FlameBusiness } from "@/lib/flame-business";

/** Pick your FLAME PH listing, preview what will be filled in, agree, then create or update your store. */
export function FlameImportForm({ businesses, hasStore, linkedIds }: { businesses: FlameBusiness[]; hasStore: boolean; linkedIds: string[] }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(importFlameBusiness, undefined);
  const [picked, setPicked] = useState(businesses[0]?.id ?? "");
  const b = businesses.find((x) => x.id === picked);
  const linked = !!b && linkedIds.includes(b.id);

  if (state?.ok) {
    return (
      <div role="status" className="space-y-3 rounded-2xl border border-success/40 bg-success-soft p-4">
        <p className="font-bold text-success">{state.created ? t("fbiz.done_created") : t("fbiz.done_updated")}</p>
        {b?.products && <p className="text-sm"><b>{t("fbiz.products_note")}</b> {b.products}</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {state.storeSlug && <Link href={`/store/${state.storeSlug}`} className={buttonClass("primary", "md")}>{t("fbiz.view_store")}</Link>}
          <Link href="/sell/new" className={buttonClass("outline", "md")}>{t("fbiz.add_products")}</Link>
          <Link href="/jobs/post" className={buttonClass("outline", "md")}>{t("fbiz.post_job")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {businesses.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">{t("fbiz.choose")}</legend>
          {businesses.map((x) => (
            <label key={x.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-white px-3">
              <input type="radio" name="business_id" value={x.id} checked={picked === x.id} onChange={() => setPicked(x.id)} className="h-5 w-5 accent-[var(--brand)]" />
              <span className="font-semibold">{x.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      {businesses.length === 1 && <input type="hidden" name="business_id" value={picked} />}

      {b && (
        <section className="space-y-3 rounded-2xl border border-border bg-white p-4" aria-labelledby="fbiz-preview">
          <h2 id="fbiz-preview" className="font-bold text-brand-dark">{t("fbiz.preview")}</h2>
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.logoUrl && <img src={b.logoUrl} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl border border-border bg-white object-contain" />}
            <div className="min-w-0">
              <p className="text-lg font-bold">{b.name}</p>
              <p className="text-sm text-muted-foreground">{[b.sector, b.subsector].filter(Boolean).join(" · ")}</p>
              <p className="text-sm text-muted-foreground">{[b.city, b.province].filter(Boolean).join(", ")}</p>
            </div>
          </div>
          {b.description && <p className="whitespace-pre-line text-sm">{b.description}</p>}
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {b.phone && <><dt className="text-muted-foreground">{t("fbiz.phone")}</dt><dd className="break-words">{b.phone}</dd></>}
            {b.email && <><dt className="text-muted-foreground">{t("fbiz.email")}</dt><dd className="break-words">{b.email}</dd></>}
            {b.facebookUrl && <><dt className="text-muted-foreground">Facebook</dt><dd className="break-all">{b.facebookUrl}</dd></>}
          </dl>
          {b.products && <p className="rounded-xl bg-accent-soft p-3 text-sm"><b>{t("fbiz.products_note")}</b> {b.products}</p>}
          <p className="text-xs text-muted-foreground">{t("fbiz.source")} <a href={b.profileUrl} target="_blank" rel="noopener" className="underline">{b.profileUrl.replace(/^https:\/\//, "")}</a></p>
        </section>
      )}

      {!hasStore && (
        <Field label={t("fbiz.seller_type")}>
          <Select name="seller_type" required defaultValue="retailer">
            {SELLER_TYPES.map((s) => <option key={s} value={s}>{t(`seller.${s}`)}</option>)}
          </Select>
        </Field>
      )}
      {hasStore && <input type="hidden" name="seller_type" value="retailer" />}

      <fieldset className="space-y-2 rounded-2xl border border-border bg-white p-4">
        <legend className="px-1 text-sm font-semibold">{t("fbiz.contacts")}</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="show_phone" className="h-5 w-5 accent-[var(--brand)]" /> {t("fbiz.show_phone")}</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="show_email" className="h-5 w-5 accent-[var(--brand)]" /> {t("fbiz.show_email")}</label>
      </fieldset>

      <label className="flex min-h-11 items-start gap-3 rounded-xl bg-brand-soft p-3 text-sm font-semibold text-brand-dark">
        <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 accent-[var(--brand)]" />
        <span>{hasStore ? t("fbiz.consent_update") : t("fbiz.consent_create")}</span>
      </label>
      {state?.error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{t(`fbiz.err.${state.error}`)}</p>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending || !b}>
        {pending ? t("fbiz.working") : linked ? t("fbiz.sync_again") : hasStore ? t("fbiz.update_store") : t("fbiz.create_store")}
      </Button>
    </form>
  );
}
