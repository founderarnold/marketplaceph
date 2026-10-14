"use client";

import { ArrowLeft, BadgeCheck, BriefcaseBusiness, Megaphone, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import type { AuthProviders } from "@/lib/auth-providers";
import { friendlyAuthError } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";


const OPEN_EVENT = "mph-auth-open";
const SNOOZE_KEY = "mph-auth-snooze";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // a dismissed popup stays away for 3 days
const AUTO_OPEN_MS = 12_000;

type Mode = "signin" | "signup";

/** Opens the sign-in popup from anywhere (header button, home cards). */
export function openAuth(mode: Mode = "signin") {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: mode }));
}

/** A button that opens the popup. Without JS it is still a link to the full /login page. */
export function SignInButton({ mode = "signin", className, children }: { mode?: Mode; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href="/login"
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        openAuth(mode);
      }}
    >
      {children}
    </Link>
  );
}

function snoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_MS;
  } catch {
    return true; // storage blocked: never auto-open, so the popup can't nag on every page view
  }
}

/**
 * "Sign in or create account" popup for guests, modelled on the big marketplaces: social first, then one email
 * field, then the password. It opens from the header, and once on the home page after a short browse.
 */
export function AuthModal({ providers }: { providers: AuthProviders }) {
  const GOOGLE_LOGIN = providers.google;
  const PHONE_LOGIN = providers.phone;
  const { t } = useT();
  const router = useRouter();
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<"start" | "password">("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onOpen = (e: Event) => {
      setMode((e as CustomEvent<Mode>).detail ?? "signin");
      setError(null);
      setInfo(null);
      if (!ref.current?.open) ref.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (path !== "/" || snoozed()) return;
    const id = setTimeout(() => {
      if (!document.querySelector("dialog[open]")) ref.current?.showModal();
    }, AUTO_OPEN_MS);
    return () => clearTimeout(id);
  }, [path]);

  function close() {
    ref.current?.close();
  }

  function onClose() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setStep("start");
    setPassword("");
  }

  const next = path.startsWith("/login") ? "/" : path;

  function google() {
    start(async () => {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) setError(t("auth.google_unavailable"));
    });
  }

  function forgot() {
    setError(null);
    start(async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/account/password` });
      if (error) return setError(friendlyAuthError(error, t));
      setInfo(t("auth.forgot_sent", { email }));
    });
  }

  function submitPassword() {
    setError(null);
    start(async () => {
      const supabase = createClient();
      const res = mode === "signup" ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (res.error) return setError(mode === "signup" ? friendlyAuthError(res.error, t) : res.error.status === 429 ? t("auth.too_many") : t("auth.bad_credentials"));
      if (mode === "signup" && !res.data.session) return setInfo(t("auth.check_email"));
      close();
      router.refresh();
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && close()}
      aria-labelledby="auth-modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-3xl overflow-hidden rounded-3xl p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
    >
      <div className="grid md:grid-cols-[1fr_1.1fr]">
        {/* Brand side: what you get for signing up */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand-sky p-8 text-white md:flex">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-wordmark.webp" alt="" width={120} height={55} className="h-12 w-auto rounded-lg bg-white p-1" />
            <p className="mt-6 text-2xl font-extrabold leading-tight">{t("auth.modal_side_title")}</p>
            <p className="mt-2 text-sm text-white/85">{t("auth.modal_side_sub")}</p>
          </div>
          <ul className="mt-8 space-y-3">
            {[
              { icon: Megaphone, label: t("auth.modal_chip1") },
              { icon: BadgeCheck, label: t("auth.modal_chip2") },
              { icon: BriefcaseBusiness, label: t("auth.modal_chip3") },
            ].map(({ icon: Icon, label }, i) => (
              <li key={label} className={cn("flex w-fit items-center gap-2 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold text-brand-dark shadow", i === 1 && "ml-8")}>
                <span className="h-4 w-1 rounded-full bg-accent" aria-hidden />
                <Icon size={16} className="text-brand" aria-hidden /> {label}
              </li>
            ))}
          </ul>
          <span className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-accent/30 blur-2xl" aria-hidden />
        </div>

        {/* Form side */}
        <div className="relative space-y-4 bg-white p-6 sm:p-8">
          <button type="button" onClick={close} aria-label={t("auth.close")} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <X size={22} aria-hidden />
          </button>
          <h2 id="auth-modal-title" className="pr-10 text-2xl font-extrabold text-brand-dark">
            {mode === "signup" ? t("auth.modal_title_signup") : t("auth.modal_title")}
          </h2>

          {step === "start" ? (
            <>
              {GOOGLE_LOGIN && (
                <Button type="button" variant="outline" className="w-full border-slate-300" onClick={google} disabled={pending}>
                  <GoogleMark /> {t("auth.google")}
                </Button>
              )}
              {PHONE_LOGIN && (
                <Link href={`/login?next=${encodeURIComponent(next)}`} onClick={close} className="btn inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold hover:bg-muted">
                  <Smartphone size={18} className="text-brand" aria-hidden /> {t("auth.phone_continue")}
                </Link>
              )}
              {(GOOGLE_LOGIN || PHONE_LOGIN) && (
                <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> {t("auth.or")} <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  setStep("password");
                }}
              >
                <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.email_placeholder")} aria-label={t("auth.email")} />
                <Button type="submit" variant="accent" className="w-full rounded-full">
                  {t("auth.continue")}
                </Button>
              </form>
            </>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                submitPassword();
              }}
            >
              <button type="button" onClick={() => { setStep("start"); setError(null); setInfo(null); }} className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                <ArrowLeft size={16} aria-hidden /> {email}
              </button>
              <Input
                type="password"
                autoFocus
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? t("auth.password_new") : t("auth.password")}
                aria-label={t("auth.password")}
              />
              {mode === "signup" && <p className="text-xs text-muted-foreground">{t("auth.password_hint")}</p>}
              <Button type="submit" variant="accent" className="w-full rounded-full" disabled={pending}>
                {mode === "signup" ? t("auth.signup") : t("auth.login")}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-sm font-semibold text-brand underline" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setInfo(null); }}>
                  {mode === "signup" ? t("auth.have_account") : t("auth.no_account")}
                </button>
                {mode === "signin" && (
                  <button type="button" className="text-sm text-muted-foreground underline" onClick={forgot} disabled={pending}>
                    {t("auth.forgot")}
                  </button>
                )}
              </div>
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
          <p className="pt-2 text-xs text-muted-foreground">{t("auth.privacy")}</p>
        </div>
      </div>
    </dialog>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
