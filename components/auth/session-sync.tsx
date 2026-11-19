"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SESSION_ENDED_COOKIE } from "@/lib/session-ended";

/**
 * The header comes from the root layout, and moving between pages keeps it as it was. When the server ends this
 * session during such a move (logged out on flameph.org or another FLAME PH site, or the session expired), the
 * header would still say "signed in" while every member page (Set up store, Account…) asks to log in.
 * The server leaves a short-lived marker; this reloads the page once so the header matches.
 */
export function SessionSync({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    const ended = document.cookie.split("; ").some((c) => c.startsWith(`${SESSION_ENDED_COOKIE}=`));
    if (!ended) return;
    document.cookie = `${SESSION_ENDED_COOKIE}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
    if (signedIn) window.location.reload(); // the header on screen is stale; a fresh load draws it signed out
  }, [pathname, signedIn]);
  return null;
}
