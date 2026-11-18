import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, LINK_COOKIE, SSO_COOKIE, checkState, hostCookie, hubCall, nonceMatches, signInByEmail, signLink } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";
import { createAdminClient, createClient } from "@/lib/supabase/server";

type Who = { sub: string; email: string; name: string | null; nonce: string; iat: number };

/**
 * flameph.org sends visitors back here with a one-time ticket and the `state` this browser started with, or with
 * error=login_required / sso_off. The ticket is swapped server-to-server; the nonce the hub hands back must match the
 * one in this browser's cookie. A ticket from another browser (a link someone sent) is refused.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;
  let next = "/";
  try {
    const u = new URL(sp.get("next") ?? "/", origin);
    if (u.origin === origin || u.origin === "https://www.marketplaceph.com" || u.origin === "https://marketplaceph.com") next = safeNext(u.pathname + u.search);
  } catch {}

  const bound = checkState(request.cookies.get(AUTH_COOKIE)?.value, sp.get("state"));
  const code = sp.get("code");
  let signedIn = false;
  let link: string | null = null;
  if (bound && code) {
    const who = await hubCall<Who>("/api/sso/token", "sso-token", { code });
    if (who?.email && who.sub && nonceMatches(bound.nonce, who.nonce)) {
      const supabase = await createClient();
      const admin = createAdminClient();
      let current = (await supabase.auth.getUser()).data.user;
      if (current?.email?.toLowerCase() !== who.email) {
        if (await signInByEmail(admin, supabase, who.email, who.name ?? undefined)) current = (await supabase.auth.getUser()).data.user;
        else console.error("auth/flame: could not sign in");
      }
      if (current?.email?.toLowerCase() === who.email) {
        signedIn = true;
        // Remember this member's private FLAME PH code (used to show their badge on their store page).
        if (current.app_metadata?.flame_sub !== who.sub) await admin.auth.admin.updateUserById(current.id, { app_metadata: { ...current.app_metadata, flame_sub: who.sub } });
        const now = Math.floor(Date.now() / 1000);
        link = signLink({ sub: who.sub, uid: current.id, since: now, chk: now });
      }
    } else if (code) {
      console.error("auth/flame: ticket refused");
    }
  } else if (code) {
    console.error("auth/flame: browser check failed");
  }
  const res = NextResponse.redirect(`${origin}${next}`, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  res.cookies.set(AUTH_COOKIE, "", { ...hostCookie, maxAge: 0 });
  if (link) res.cookies.set(LINK_COOKIE, link, { ...hostCookie, maxAge: 60 * 60 * 24 * 30 });
  if (!signedIn) res.cookies.set(SSO_COOKIE, "checked", { ...hostCookie, maxAge: 60 * 60 * 6 });
  return res;
}
