"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { normalizePhonePH, safeNext } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "phone" | "email";

// Phone OTP and Google need provider setup in Supabase first, so they stay hidden until these flags are "true".
const PHONE_LOGIN = process.env.NEXT_PUBLIC_PHONE_LOGIN === "true";
const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true";

export function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>(PHONE_LOGIN ? "phone" : "email");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const done = () => {
    router.push(next);
    router.refresh();
  };

  function sendOtp() {
    setError(null);
    const e164 = normalizePhonePH(phone);
    if (!e164) return setError(t("auth.bad_phone"));
    start(async () => {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (error) return setError(error.message.toLowerCase().includes("rate") ? t("auth.too_many") : t("auth.otp_failed"));
      setOtpSent(true);
      setInfo(t("auth.otp_sent", { phone: e164 }));
    });
  }

  function verifyOtp() {
    setError(null);
    const e164 = normalizePhonePH(phone);
    if (!e164) return setError(t("auth.bad_phone"));
    start(async () => {
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: "sms" });
      if (error) return setError(t("auth.bad_code"));
      done();
    });
  }

  function emailAuth() {
    setError(null);
    start(async () => {
      const res = isSignup
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (res.error) return setError(isSignup ? res.error.message : t("auth.bad_credentials"));
      if (isSignup && !res.data.session) return setInfo(t("auth.check_email"));
      done();
    });
  }

  function google() {
    start(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setError(t("auth.google_unavailable"));
    });
  }

  return (
    <div className="space-y-5 rounded-3xl border border-border bg-white p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("auth.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
      </div>

      {PHONE_LOGIN && (
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-semibold">
        {(["phone", "email"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className={cn("rounded-lg py-2", mode === m ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}
          >
            {m === "phone" ? t("auth.tab_phone") : t("auth.tab_email")}
          </button>
        ))}
      </div>
      )}

      {mode === "phone" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (otpSent) verifyOtp();
            else sendOtp();
          }}
        >
          <Field label={t("auth.phone")} hint={t("auth.phone_hint")}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09XX XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={otpSent}
              required
            />
          </Field>
          {otpSent && (
            <Field label={t("auth.code")}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-xl tracking-[0.5em]"
                required
              />
            </Field>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {otpSent ? t("auth.verify") : t("auth.send_code")}
          </Button>
          {otpSent && (
            <button type="button" className="text-sm text-brand underline" onClick={() => { setOtpSent(false); setCode(""); setInfo(null); }}>
              {t("auth.change_number")}
            </button>
          )}
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            emailAuth();
          }}
        >
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t("auth.password")} hint={isSignup ? t("auth.password_hint") : undefined}>
            <Input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {isSignup ? t("auth.signup") : t("auth.login")}
          </Button>
          <button type="button" className="text-sm text-brand underline" onClick={() => setIsSignup((s) => !s)}>
            {isSignup ? t("auth.have_account") : t("auth.no_account")}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {info && !error && (
        <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-medium text-success">
          {info}
        </p>
      )}

      {GOOGLE_LOGIN && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={google} disabled={pending}>
            {t("auth.google")}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("auth.privacy")}</p>
    </div>
  );
}
