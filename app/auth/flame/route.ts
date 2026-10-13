import { NextResponse, type NextRequest } from "next/server";
import { SSO_COOKIE, signInByEmail, verifyToken } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** flameph.org sends visitors back here with a signed token (signed in there) or error=login_required. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;
  // The hub returns the full URL the visitor was on; only follow it on this site.
  let next = "/";
  try {
    const u = new URL(sp.get("next") ?? "/", origin);
    if (u.origin === origin) next = safeNext(u.pathname + u.search);
  } catch {}

  const token = sp.get("token");
  const claims = token ? verifyToken(token) : null;
  if (claims) {
    const supabase = await createClient();
    const current = (await supabase.auth.getUser()).data.user;
    if (current?.email?.toLowerCase() !== claims.email) {
      const ok = await signInByEmail(createAdminClient(), supabase, claims.email, claims.name);
      if (!ok) console.error("auth/flame: could not sign in");
    }
  }
  const res = NextResponse.redirect(`${origin}${next}`, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
  if (!claims) res.cookies.set(SSO_COOKIE, "checked", { maxAge: 60 * 60 * 6, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  return res;
}
