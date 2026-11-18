"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HUB_URL, LINK_COOKIE, SSO_COOKIE, hostCookie, hubCall, readLink, signSiteCall, ssoEnabled } from "@/lib/flame-sso";
import { createClient } from "@/lib/supabase/server";

/**
 * Log out here and everywhere: tell flameph.org server-to-server (every other site then ends this member's session
 * within 5 minutes), then pass through flameph.org with a signed, single-use logout so it logs out there too.
 */
export async function signOut() {
  const supabase = await createClient();
  const jar = await cookies();
  const link = readLink(jar.get(LINK_COOKIE)?.value);
  if (link && ssoEnabled()) await hubCall("/api/sso/logout", "sso-logout", { sub: link.sub });
  await supabase.auth.signOut();
  jar.set(LINK_COOKIE, "", { ...hostCookie, maxAge: 0 });
  if (!ssoEnabled()) redirect("/");
  // Stay logged out: no automatic sign-in from flameph.org until they sign in again.
  jar.set(SSO_COOKIE, "off", { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  const t = signSiteCall("logout", {});
  redirect(`${HUB_URL}/sso/logout?client=marketplaceph&return=${encodeURIComponent("https://www.marketplaceph.com/")}${t ? `&t=${encodeURIComponent(t)}` : ""}`);
}
