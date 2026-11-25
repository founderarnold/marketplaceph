"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBasicJobProfile } from "@/app/actions/jobs-companion";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";

export type BasicProfile = {
  full_name?: string | null; phone?: string | null; contact_email?: string | null; desired_roles?: string | null;
  region_code?: string | null; province_code?: string | null; city_code?: string | null;
};

/**
 * "Apply Now" for someone without a ready job profile: one button opens step 1 (basic information + consent).
 * Saving it refreshes the page, which then shows step 2 (choose documents, add a note, send).
 */
export function QuickApply({ next, locations, profile, defaultName, jobTitle }: { next: string; locations: Locations; profile: BasicProfile | null; defaultName: string; jobTitle: string }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = (k: keyof BasicProfile, d = "") => profile?.[k] ?? d;

  if (!open) {
    return (
      <div className="space-y-2">
        <Button type="button" size="lg" variant="accent" className="w-full" onClick={() => setOpen(true)}>{t("comp.btn.apply")}</Button>
        <p className="text-xs text-muted-foreground">{t("comp.apply.two_steps")}</p>
      </div>
    );
  }
  return (
    <form
      id="apply"
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveBasicJobProfile(fd);
          if (!r.ok) {
            return setError(r.error === "invalid" ? t("comp.apply.invalid") : r.error === "contact" ? t("comp.apply.need_contact") : r.error === "consent" ? t("job.pf.need_consent") : r.error && r.error !== "failed" ? r.error : t("common.error"));
          }
          router.refresh();
        });
      }}
    >
      <p className="rounded-xl bg-brand-soft p-2 text-sm font-semibold text-brand-dark">{t("comp.apply.step1", { title: jobTitle })}</p>
      <input type="hidden" name="next" value={next} />
      <Field label={t("job.pf.full_name")}><Input name="full_name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={v("full_name", defaultName)} /></Field>
      <Field label={t("job.pf.phone")}><Input name="phone" type="tel" inputMode="tel" minLength={7} maxLength={20} autoComplete="tel" placeholder="09XX XXX XXXX" defaultValue={v("phone")} /></Field>
      <Field label={t("job.pf.email")} hint={t("comp.apply.contact_hint")}><Input name="contact_email" type="email" maxLength={120} autoComplete="email" defaultValue={v("contact_email")} /></Field>
      <Field label={t("comp.apply.want")} hint={t("comp.apply.want_hint")}><Input name="desired_roles" maxLength={200} defaultValue={v("desired_roles", jobTitle)} /></Field>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{t("comp.apply.where")}</p>
        <LocationSelect locations={locations} defaultValue={{ region: v("region_code"), province: v("province_code"), city: v("city_code") }} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-accent-soft p-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]" />
        <span>{t("comp.apply.consent")}</span>
      </label>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={pending}>{pending ? t("job.pf.saving") : t("comp.apply.save_next")}</Button>
      <p className="text-xs text-muted-foreground">{t("comp.apply.later")}</p>
    </form>
  );
}
