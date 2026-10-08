"use client";

import { useActionState, useState } from "react";
import { updateStore } from "@/app/actions/sell";
import { ImageUploader } from "@/components/sell/image-uploader";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

export type StoreProfile = {
  name: string;
  tagline: string | null;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  facebook_url: string | null;
  website_url: string | null;
  logo_url: string | null;
};

/** Edit the public storefront: logo, tagline, description, contact details and the Facebook Page / website links. */
export function StoreProfileForm({ userId, store }: { userId: string; store: StoreProfile }) {
  const { t } = useT();
  const [logo, setLogo] = useState<string[]>(store.logo_url ? [store.logo_url] : []);
  const [state, action, pending] = useActionState(updateStore.bind(null, logo[0] ?? null), undefined);
  const v = state?.values ?? {};
  const val = (k: keyof StoreProfile) => v[k] ?? store[k] ?? "";

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-border bg-white p-5">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("store.edit_title")}</h1>
        <p className="text-sm text-muted-foreground">{store.name}</p>
      </div>
      <Field label={t("store.logo")} hint={t("store.logo_hint")}>
        <ImageUploader userId={userId} value={logo} onChange={(p) => setLogo(p.slice(-1))} bucket="store-assets" max={1} withThumb={false} />
      </Field>
      <Field label={t("store.tagline")} hint={t("store.optional")}>
        <Input name="tagline" maxLength={160} defaultValue={val("tagline")} />
      </Field>
      <Field label={t("store.description")} hint={t("store.optional")}>
        <Textarea name="description" rows={4} maxLength={2000} defaultValue={val("description")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("store.contact_phone")} hint={t("store.contact_phone_hint")}>
          <Input name="contact_phone" type="tel" inputMode="tel" maxLength={20} defaultValue={val("contact_phone")} />
        </Field>
        <Field label={t("store.contact_email")} hint={t("store.optional")}>
          <Input name="contact_email" type="email" maxLength={120} defaultValue={val("contact_email")} />
        </Field>
        <Field label={t("store.facebook_page")} hint={t("store.links_hint")}>
          <Input name="facebook_url" type="url" inputMode="url" maxLength={200} placeholder="https://facebook.com/yourpage" defaultValue={val("facebook_url")} />
        </Field>
        <Field label={t("store.website")} hint={t("store.links_hint")}>
          <Input name="website_url" type="url" inputMode="url" maxLength={200} placeholder="https://" defaultValue={val("website_url")} />
        </Field>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {state.error === "invalid" ? t("store.links_invalid") : t("common.error")}
        </p>
      )}
      {v.saved && !state?.error && (
        <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">
          ✓ {t("store.saved")}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
