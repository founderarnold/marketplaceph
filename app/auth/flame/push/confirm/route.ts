import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, HUB_URL, PUSH_COOKIE, hostCookie } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Step 2 of signing in on flameph.org after signing in here. flameph.org sent the visitor back with the ticket; we
 * check this browser holds that same ticket (so it started here), then send the browser secret on to flameph.org.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;
  let next = "/";
  try {
    const u = new URL(sp.get("next") ?? "/", origin);
    if (["https://www.marketplaceph.com", "https://marketplaceph.com", origin].includes(u.origin)) next = safeNext(u.pathname + u.search);
  } catch {}
  const [code, proof] = (request.cookies.get(PUSH_COOKIE)?.value ?? "").split(".");
  const [state, nonce] = (request.cookies.get(AUTH_COOKIE)?.value ?? "").split(".");
  const ticket = sp.get("code") ?? "";
  const h = sp.get("h") ?? "";
  const ok = code && proof && state && nonce && h && same(code, ticket);
  const finish = ok
    ? `${HUB_URL}/sso/establish/finish?${new URLSearchParams({ code, proof, h, state, nonce, next: `https://www.marketplaceph.com${next}` })}`
    : `${origin}${next}`;
  if (!ok) console.error("auth/flame/push: browser check failed");
  const res = NextResponse.redirect(finish, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  res.cookies.set(PUSH_COOKIE, "", { ...hostCookie, maxAge: 0 });
  return res;
}
