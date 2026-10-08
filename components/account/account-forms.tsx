"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteMyAccount, updateProfile } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

export function ProfileForm({ displayName, locale, sheetPublic }: { displayName: string; locale: string; sheetPublic: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-border bg-white p-4">
      <Field label={t("account.display_name")}>
        <Input name="display_name" defaultValue={displayName} required maxLength={80} />
      </Field>
      <Field label={t("account.language")}>
        <Select name="locale" defaultValue={locale}>
          <option value="en">English</option>
          <option value="fil">Filipino / Taglish</option>
        </Select>
      </Field>
      <label className="flex items-start gap-3 rounded-xl bg-muted p-3 text-sm">
        <input type="checkbox" name="sheet_public" defaultChecked={sheetPublic} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
        <span>
          <span className="block font-semibold text-brand-dark">{t("account.sheet_public")}</span>
          <span className="text-muted-foreground">{t("account.sheet_public_hint")}</span>
        </span>
      </label>
      <Button type="submit" disabled={pending}>
        {t("common.save")}
      </Button>
      {state?.ok && <span role="status" className="ml-3 text-sm text-success">{t("common.saved")}</span>}
      {state?.error && <span role="alert" className="ml-3 text-sm text-danger">{t("common.error")}</span>}
    </form>
  );
}

export function DeleteAccount() {
  const { t } = useT();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
      <summary className="cursor-pointer font-semibold text-danger">{t("account.delete_title")}</summary>
      <p className="mt-2 text-sm">{t("account.delete_body")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" className="max-w-40" aria-label={t("account.delete_confirm")} />
        <Button
          variant="danger"
          disabled={text !== "DELETE" || pending}
          onClick={() =>
            start(async () => {
              const res = await deleteMyAccount(text);
              if (res?.error) setMsg(res.error === "unavailable" ? t("account.delete_unavailable") : t("common.error"));
            })
          }
        >
          {t("account.delete_btn")}
        </Button>
      </div>
      {msg && <p role="alert" className="mt-2 text-sm font-medium text-danger">{msg}</p>}
    </details>
  );
}
