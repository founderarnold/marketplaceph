import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, HUB_URL, SSO_CLIENT, SSO_COOKIE, hostCookie, randomToken, ssoEnabled } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";

/**
 * Sends the visitor to flameph.org to find out who they are, with a one-time check kept in this browser (Phase 10A).
 *   /auth/flame/start?next=/path                    sign in on flameph.org if needed
 *   /auth/flame/start?auto=google|facebook&next=…   go straight to that sign-in button on flameph.org
 *   /auth/flame/start?silent=1&next=…               only check, never show a login page
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;
  const next = safeNext(sp.get("next"));
  if (!ssoEnabled()) return NextResponse.redirect(`${origin}${next}`);
  const silent = sp.get("silent") === "1";
  const auto = sp.get("auto");
  const [state, nonce] = [randomToken(), randomToken()];
  const back = `https://www.marketplaceph.com${next}`;
  const authorize = `/sso/authorize?client=${SSO_CLIENT}&return=${encodeURIComponent(back)}&state=${state}&nonce=${nonce}${silent ? "&silent=1" : ""}`;
  const target = !silent && (auto === "google" || auto === "facebook")
    ? `${HUB_URL}/login?auto=${auto}&next=${encodeURIComponent(authorize)}`
    : `${HUB_URL}${authorize}`;
  const res = NextResponse.redirect(target, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(AUTH_COOKIE, `${state}.${nonce}`, { ...hostCookie, maxAge: 60 * 15 });
  if (silent) res.cookies.set(SSO_COOKIE, "checked", { ...hostCookie, maxAge: 60 * 60 * 6 });
  else res.cookies.delete(SSO_COOKIE);
  return res;
}
