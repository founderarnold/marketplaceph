import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One account across the FLAME PH ecosystem, with flameph.org as the hub. Visitors who are signed in on flameph.org
 * are signed in here automatically, and signing in here also signs them in on flameph.org. Since Phase 10A the address
 * carries only one-time tickets bound to the visitor's browser, and everything else goes server-to-server, signed
 * with this site's own key (SSO_SECRET_MARKETPLACEPH; the old shared SSO_SECRET until that is set).
 * Accounts are matched by verified email. Everything is off until a key is set.
 */

export const SSO_CLIENT = "marketplaceph";
export const SSO_HUB = "flameph";
export const HUB_URL = "https://www.flameph.org";
/** Cookie that stops repeat checks with the hub: "checked" for a while after asking, "off" after logging out. */
export const SSO_COOKIE = "flame_sso";

const strong = (s: string | undefined) => (s && s.length >= 32 ? s : null);
/** This site's own key (Phase 10A). Until it is set, the old shared SSO_SECRET still works. */
const secret = () => strong(process.env.SSO_SECRET_MARKETPLACEPH) ?? strong(process.env.SSO_SECRET);
export const ssoEnabled = () => secret() !== null;

const mac = (key: string, data: string) => createHmac("sha256", key).update(data).digest();
const b64 = (v: string | Buffer) => Buffer.from(v).toString("base64url");
export const randomToken = (bytes = 24) => randomBytes(bytes).toString("base64url");
export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Phase 10A: the visitor's browser keeps a random `state` and `nonce` here while they go to flameph.org. The hub sends
 * back only a one-time ticket plus `state`; this server swaps the ticket at the hub and the hub hands back `nonce`.
 * Both must match this cookie, so a ticket that started in someone else's browser can never sign this visitor in.
 * Host-only (__Host-, no Domain), so no other site or subdomain can read or plant it.
 */
export const AUTH_COOKIE = "__Host-flame_auth";
/** Who flameph.org says this member is, and when this session started: checked with the hub every 5 minutes. */
export const LINK_COOKIE = "__Host-flame_link";
/** Proof for signing in on flameph.org after signing in here (see /auth/flame/push). */
export const PUSH_COOKIE = "__Host-flame_push";
export const hostCookie = { path: "/", sameSite: "lax" as const, secure: true, httpOnly: true };
export const SESSION_CHECK_SECONDS = 300;

/** A signed message to the hub: right key, a purpose, a single-use id, 2 minutes to live. Never a sign-in token. */
export function signSiteCall(purpose: string, claims: Record<string, unknown>, ttlSeconds = 120): string | null {
  const key = secret();
  if (!key) return null;
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...claims, iss: SSO_CLIENT, aud: SSO_HUB, typ: purpose, jti: randomToken(18), iat: now, exp: now + ttlSeconds }));
  return `v1.${body}.${b64(mac(key, `${purpose}.${body}`))}`;
}

/** Calls the hub server-to-server. Returns the JSON answer, or null on any failure within `waitMs`.
 * Sign-in steps wait up to 10 seconds (the hub can take a few seconds; giving up early wastes the one-time ticket
 * and leaves the member signed out). Checks made while a page loads pass a shorter wait.
 */
export async function hubCall<T = Record<string, unknown>>(path: string, purpose: string, claims: Record<string, unknown>, waitMs = 10000): Promise<T | null> {
  const token = signSiteCall(purpose, claims);
  if (!token) return null;
  try {
    const r = await fetch(`${HUB_URL}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client: SSO_CLIENT, token }),
      cache: "no-store", signal: AbortSignal.timeout(waitMs),
    });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** A notice from the hub (for example "drop this member's badge"), signed with this site's key. */
export function verifyHubMessage(purpose: string, token: string): Record<string, unknown> | null {
  const key = secret();
  const [v, body, sig] = (token ?? "").split(".");
  if (!key || v !== "v1" || !body || !sig) return null;
  const want = mac(key, `${purpose}.${body}`);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== SSO_HUB || c.aud !== SSO_CLIENT || c.typ !== purpose || typeof c.exp !== "number" || !(c.exp > now) || (c.iat as number) > now + 30) return null;
    return c;
  } catch {
    return null;
  }
}

/** The link cookie: { sub, uid, since, chk }, signed with this site's key so it can't be edited. */
export type Link = { sub: string; uid: string; since: number; chk: number };
export function signLink(l: Link): string | null {
  const key = secret();
  if (!key) return null;
  const body = b64(JSON.stringify(l));
  return `${body}.${b64(mac(key, `link.${body}`))}`;
}
export function readLink(value: string | undefined): Link | null {
  const key = secret();
  const [body, sig] = (value ?? "").split(".");
  if (!key || !body || !sig || !same(sig, b64(mac(key, `link.${body}`)))) return null;
  try {
    const l = JSON.parse(Buffer.from(body, "base64url").toString()) as Link;
    return typeof l.sub === "string" && typeof l.uid === "string" && typeof l.since === "number" && typeof l.chk === "number" ? l : null;
  } catch {
    return null;
  }
}

/** Reads the browser's `state.nonce` cookie and checks the state the hub sent back. */
export function checkState(cookie: string | undefined, state: string | null): { nonce: string } | null {
  const [s, n] = (cookie ?? "").split(".");
  return s && n && state && same(s, state) ? { nonce: n } : null;
}
export const nonceMatches = (a: string, b: unknown) => typeof b === "string" && same(a, b);

/** Signs the visitor in as the account with this verified email, creating it if needed. */
export async function signInByEmail(admin: SupabaseClient, session: SupabaseClient, email: string, name?: string): Promise<boolean> {
  // Failures are logged with the step and the provider's message (never the token or keys) so a failed sign-in can be diagnosed.
  const fail = (step: string, e: { message?: string; status?: number; code?: string } | null | undefined) =>
    console.error(`flame-sso: ${step} failed:`, e?.status ?? "", e?.code ?? "", e ? "" : "no hashed_token returned"); // never log e.message: it can echo the secret key
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: name ? { full_name: name } : {} });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    fail("createUser", created.error);
    return false;
  }
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link.data?.properties?.hashed_token;
  if (link.error || !hash) {
    fail("generateLink", link.error);
    return false;
  }
  const { error } = await session.auth.verifyOtp({ token_hash: hash, type: "magiclink" });
  if (error) fail("verifyOtp", error);
  return !error;
}
