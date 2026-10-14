"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const { t } = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError(t("auth.password_mismatch"));
    start(async () => {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) return setError(friendlyAuthError(error, t));
      setDone(true);
      setPassword("");
      setConfirm("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-border bg-white p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("auth.new_password_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.password_hint")}</p>
      </div>
      <Field label={t("auth.password_new")}>
        <Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label={t("auth.password_confirm")}>
        <Input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p>}
      {done && <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-medium text-success">{t("auth.password_saved")}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{t("common.save")}</Button>
    </form>
  );
}
