"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { HUB_URL, SSO_COOKIE, ssoEnabled } from "@/lib/flame-sso";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (!ssoEnabled()) redirect("/");
  // Stay logged out: no automatic sign-in from flameph.org until they sign in again, and log out there too.
  (await cookies()).set(SSO_COOKIE, "off", { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: true, httpOnly: true });
  redirect(`${HUB_URL}/sso/logout?client=marketplaceph&return=${encodeURIComponent("https://www.marketplaceph.com/")}`);
}
