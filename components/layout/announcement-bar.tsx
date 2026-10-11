"use client";

import { Construction, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";

const KEY = "mph-announce-v1";
const EVENT = "mph-announce-change";

// Dismissal is read from localStorage without an effect, so the bar never flashes and hydration stays consistent.
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function dismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked: keep showing
  }
}

/**
 * Thin notice below the footer: the site is still being built and people can sign up now to get updates.
 * It can be dismissed (remembered on this device); if storage is unavailable it simply shows every visit.
 */
export function AnnouncementBar({ signedIn }: { signedIn: boolean }) {
  const { t } = useT();
  const hidden = useSyncExternalStore(subscribe, dismissed, () => false);
  // On phones the fixed bottom navigation covers the last ~4rem of the page, so keep that space free whether or not the bar shows.
  if (hidden) return <div className="h-16 md:hidden" aria-hidden />;
  return (
    <div role="region" aria-label={t("announce.label")} className="relative bg-brand-dark px-10 pb-20 pt-3 text-center text-xs text-white sm:text-sm md:pb-3">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <Construction size={16} className="shrink-0 text-accent" aria-hidden />
        <span>
          <b>{t("announce.title")}</b> {t("announce.body")}
        </span>
        {!signedIn && (
          <Link href="/login" className="rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-brand-dark hover:brightness-95">
            {t("announce.cta")}
          </Link>
        )}
      </p>
      <button
        type="button"
        aria-label={t("announce.close")}
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* ignore */
          }
          window.dispatchEvent(new Event(EVENT));
        }}
        className="absolute right-1 top-3 grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
