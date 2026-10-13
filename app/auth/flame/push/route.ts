import { NextResponse, type NextRequest } from "next/server";
import { HUB_URL, SSO_COOKIE, signToken } from "@/lib/flame-sso";
import { safeNext } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** After signing in here, pass through flameph.org so the visitor is signed in there too, then come back to `next`. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const user = (await (await createClient()).auth.getUser()).data.user;
  const token = user?.email && user.email_confirmed_at ? signToken(user.email, (user.user_metadata?.full_name as string) || undefined) : null;
  const res = NextResponse.redirect(
    token ? `${HUB_URL}/sso/establish?token=${encodeURIComponent(token)}&next=${encodeURIComponent(origin + next)}` : `${origin}${next}`,
    { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } },
  );
  res.cookies.delete(SSO_COOKIE); // they chose to sign in, so automatic sign-in is back on
  return res;
}
