import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, HUB_URL, PUSH_COOKIE, SSO_COOKIE, hostCookie, hubCall, randomToken, sha256 } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * After signing in here, pass through flameph.org so the visitor is signed in there too, then come back to `next`.
 * Phase 10A: this server asks the hub for a one-time ticket, giving the hash of a secret it keeps in this browser's
 * cookie. The hub finishes only after /auth/flame/push/confirm shows that secret from the same browser.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const user = (await (await createClient()).auth.getUser()).data.user;
  const proof = randomToken();
  const ticket = user?.email && user.email_confirmed_at
    ? await hubCall<{ code?: string }>("/api/sso/establish-ticket", "establish-ticket", { email: user.email, name: (user.user_metadata?.full_name as string) || undefined, browser: sha256(proof) })
    : null;
  const back = `https://www.marketplaceph.com${next}`;
  const res = NextResponse.redirect(
    ticket?.code ? `${HUB_URL}/sso/establish?code=${encodeURIComponent(ticket.code)}&next=${encodeURIComponent(back)}` : `${origin}${next}`,
    { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } },
  );
  if (ticket?.code) {
    res.cookies.set(PUSH_COOKIE, `${ticket.code}.${proof}`, { ...hostCookie, maxAge: 120 });
    res.cookies.set(AUTH_COOKIE, `${randomToken()}.${randomToken()}`, { ...hostCookie, maxAge: 60 * 15 });
  }
  res.cookies.delete(SSO_COOKIE); // they chose to sign in, so automatic sign-in is back on
  return res;
}
