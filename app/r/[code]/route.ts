import { NextResponse, type NextRequest } from "next/server";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_DAYS } from "@/lib/affiliate";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Affiliate link: /r/<code>. Records the click, remembers the code in a first-party cookie for 30 days
 * (so a later order from this browser can be credited), then sends the visitor to the listing.
 * Unknown / unapproved codes just go home — no error page that reveals which codes exist.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/r/[code]">) {
  const { code } = await ctx.params;
  if (!/^[a-z0-9]{6,12}$/i.test(code)) return NextResponse.redirect(new URL("/", request.url));
  let listingId: string | null = null;
  try {
    const { data } = await createAdminClient().rpc("record_affiliate_click", { p_code: code });
    listingId = (data as string | null) ?? null;
  } catch {
    listingId = null;
  }
  if (!listingId) return NextResponse.redirect(new URL("/", request.url));
  const res = NextResponse.redirect(new URL(`/listing/${listingId}`, request.url));
  res.cookies.set(AFFILIATE_COOKIE, code.toLowerCase(), { maxAge: AFFILIATE_COOKIE_DAYS * 86_400, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return res;
}
