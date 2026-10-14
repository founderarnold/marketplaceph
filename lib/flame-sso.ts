import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One account across the FLAME PH ecosystem, with flameph.org as the hub. Visitors who are signed in on flameph.org
 * are signed in here automatically, and signing in here also signs them in on flameph.org. Messages are short-lived
 * tokens signed with SSO_SECRET, the same long random value set in every FLAME PH site's Vercel project.
 * Accounts are matched by verified email. Everything is off until SSO_SECRET is set.
 */

export const SSO_CLIENT = "marketplaceph";
export const SSO_HUB = "flameph";
export const HUB_URL = "https://www.flameph.org";
/** Cookie that stops repeat checks with the hub: "checked" for a while after asking, "off" after logging out. */
export const SSO_COOKIE = "flame_sso";

type Claims = { iss: string; aud: string; email: string; name?: string; iat: number; exp: number };

const secret = () => {
  const s = process.env.SSO_SECRET;
  return s && s.length >= 32 ? s : null;
};
export const ssoEnabled = () => secret() !== null;

const mac = (key: string, data: string) => createHmac("sha256", key).update(data).digest();

export function signToken(email: string, name?: string, ttlSeconds = 120): string | null {
  const key = secret();
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ iss: SSO_CLIENT, aud: SSO_HUB, email: email.toLowerCase(), name, iat: now, exp: now + ttlSeconds })).toString("base64url");
  return `v1.${body}.${mac(key, body).toString("base64url")}`;
}

export function verifyToken(token: string): Claims | null {
  const key = secret();
  const [v, body, sig] = token.split(".");
  if (!key || v !== "v1" || !body || !sig) return null;
  const want = mac(key, body);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as Claims;
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== SSO_HUB || c.aud !== SSO_CLIENT || !(c.exp > now) || c.iat > now + 30) return null;
    if (typeof c.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return null;
    return c;
  } catch {
    return null;
  }
}

/** Signs the visitor in as the account with this verified email, creating it if needed. */
export async function signInByEmail(admin: SupabaseClient, session: SupabaseClient, email: string, name?: string): Promise<boolean> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: name ? { full_name: name } : {} });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) return false;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link.data?.properties?.hashed_token;
  if (link.error || !hash) return false;
  const { error } = await session.auth.verifyOtp({ token_hash: hash, type: "magiclink" });
  return !error;
}
