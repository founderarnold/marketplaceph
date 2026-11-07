"use client";

import { BriefcaseBusiness, Bike, ShoppingBag, Store, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";

const KEY = "mph-onboard-v1";
const EVENT = "mph-onboard-change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
// Remembered on this device only (no database change). If storage is blocked the card simply stays out of the way.
function done() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return true;
  }
}
function remember(choice: string) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** "What brings you here?" for brand-new members (no store yet). One tap goes to the right first step; Skip hides it for good. */
export function RoleOnboarding() {
  const { t } = useT();
  const hidden = useSyncExternalStore(subscribe, done, () => true);
  if (hidden) return null;
  const cards = [
    { key: "buy", href: "/search", icon: ShoppingBag, title: t("bh.ob_buy"), body: t("bh.ob_buy_body") },
    { key: "sell", href: "/sell/new", icon: Store, title: t("bh.ob_sell"), body: t("bh.ob_sell_body") },
    { key: "jobs", href: "/jobs", icon: BriefcaseBusiness, title: t("bh.ob_jobs"), body: t("bh.ob_jobs_body") },
    { key: "rider", href: "/delivery/register", icon: Bike, title: t("bh.ob_rider"), body: t("bh.ob_rider_body") },
  ];
  return (
    <section aria-labelledby="ob-h" className="relative rounded-2xl border-2 border-accent bg-accent-soft p-4">
      <button type="button" onClick={() => remember("skip")} aria-label={t("bh.ob_skip")} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-white/60">
        <X size={18} aria-hidden />
      </button>
      <h2 id="ob-h" className="pr-10 text-lg font-extrabold text-brand-dark">{t("bh.ob_title")}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {cards.map(({ key, href, icon: Icon, title, body }) => (
          <li key={key}>
            <Link href={href} onClick={() => remember(key)} className="flex h-full flex-col gap-1 rounded-xl bg-white p-3 hover:shadow-md">
              <Icon size={22} className="text-brand" aria-hidden />
              <span className="font-bold text-brand-dark">{title}</span>
              <span className="text-xs text-muted-foreground">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => remember("skip")} className="mt-3 text-sm font-semibold text-brand underline">{t("bh.ob_skip")}</button>
    </section>
  );
}
