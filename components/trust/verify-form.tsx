"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitVerification } from "@/app/actions/verification";
import { PrivateFileInput, type UploadedFile } from "@/components/trust/private-files";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

type Slots = Record<string, UploadedFile[]>;

export function VerifyForm({ userId, storeId, currentLevel }: { userId: string; storeId: string; currentLevel: number }) {
  const { t } = useT();
  const router = useRouter();
  const target: 2 | 3 = currentLevel >= 2 ? 3 : 2;
  const [slots, setSlots] = useState<Slots>({});
  const [regType, setRegType] = useState<"dti" | "sec" | "cda">("dti");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string) => (files: UploadedFile[]) => setSlots((s) => ({ ...s, [k]: files }));

  function submit() {
    setError(null);
    const docs: { type: string; path: string }[] = [];
    const push = (slot: string, type: string) => (slots[slot] ?? []).forEach((f) => docs.push({ type, path: f.path }));
    if (target === 2) {
      push("gov_id", "gov_id");
      push("selfie", "selfie_with_id");
    } else {
      push("reg", regType);
      push("bir_cor", "bir_cor");
      push("mayors_permit", "mayors_permit");
      push("fda", "fda");
    }
    start(async () => {
      const res = await submitVerification({ storeId, target, docs: docs as never });
      if (!res.ok) return setError(res.error && res.error !== "failed" && res.error !== "invalid" ? res.error : t("common.error"));
      router.refresh();
    });
  }

  const complete =
    target === 2
      ? !!slots.gov_id?.length && !!slots.selfie?.length
      : !!slots.reg?.length && !!slots.bir_cor?.length && !!slots.mayors_permit?.length;

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-white p-5">
      <div>
        <h2 className="text-xl font-extrabold text-brand-dark">{target === 2 ? t("verify.form_id") : t("verify.form_business")}</h2>
        <p className="text-sm text-muted-foreground">{target === 2 ? t("verify.form_id_hint") : t("verify.form_business_hint")}</p>
      </div>

      {target === 2 ? (
        <>
          <Field label={t("doc.gov_id")} hint={t("doc.gov_id_hint")}>
            <PrivateFileInput userId={userId} bucket="private-docs" value={slots.gov_id ?? []} onChange={set("gov_id")} />
          </Field>
          <Field label={t("doc.selfie_with_id")} hint={t("doc.selfie_hint")}>
            <PrivateFileInput userId={userId} bucket="private-docs" value={slots.selfie ?? []} onChange={set("selfie")} />
          </Field>
        </>
      ) : (
        <>
          <Field label={t("doc.registration")}>
            <Select value={regType} onChange={(e) => setRegType(e.target.value as typeof regType)}>
              <option value="dti">{t("doc.dti")}</option>
              <option value="sec">{t("doc.sec")}</option>
              <option value="cda">{t("doc.cda")}</option>
            </Select>
          </Field>
          <PrivateFileInput userId={userId} bucket="private-docs" value={slots.reg ?? []} onChange={set("reg")} />
          <Field label={t("doc.bir_cor")}>
            <PrivateFileInput userId={userId} bucket="private-docs" value={slots.bir_cor ?? []} onChange={set("bir_cor")} />
          </Field>
          <Field label={t("doc.mayors_permit")}>
            <PrivateFileInput userId={userId} bucket="private-docs" value={slots.mayors_permit ?? []} onChange={set("mayors_permit")} />
          </Field>
          <Field label={t("doc.fda")} hint={t("doc.fda_hint")}>
            <PrivateFileInput userId={userId} bucket="private-docs" value={slots.fda ?? []} onChange={set("fda")} />
          </Field>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" disabled={!complete || pending} onClick={submit}>
        {pending ? t("sell.posting") : t("verify.submit")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("verify.privacy_note")}</p>
    </div>
  );
}
