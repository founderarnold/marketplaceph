/**
 * Privacy-safe acquisition attribution for Jobs 2.0 (P2).
 * Keeps only UTM fields and an opaque chapter/referrer code. Anything that could identify a person
 * (an email, a phone number, a long number, spaces, a Facebook click id) is dropped, never stored.
 */
export const ATTR_COOKIE = "mph_jobs_attr";
export const ATTR_DAYS = 30;
export const ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ch"] as const;
export type Attribution = Partial<Record<(typeof ATTR_KEYS)[number], string>>;

const SAFE = /^[a-z0-9][a-z0-9_.-]{0,39}$/;

/** One value: lowercased, 1–40 chars of a-z 0-9 _ . -, no @, no run of 7+ digits (phone-like). Otherwise null. */
export function cleanValue(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!SAFE.test(s) || s.includes("@") || /\d{7,}/.test(s)) return null;
  return s;
}

/** Picks the allowed keys from URL search params. Unknown keys (fbclid, name, email, phone…) are ignored. */
export function attributionFrom(params: Record<string, string | string[] | undefined> | URLSearchParams): Attribution {
  const get = (k: string) => (params instanceof URLSearchParams ? params.get(k) : Array.isArray(params[k]) ? params[k]?.[0] : params[k]);
  const out: Attribution = {};
  for (const k of ATTR_KEYS) {
    const v = cleanValue(get(k));
    if (v) out[k] = v;
  }
  return out;
}

export function encodeAttr(a: Attribution): string {
  return ATTR_KEYS.filter((k) => a[k]).map((k) => `${k}=${a[k]}`).join("&");
}

/** Reads the cookie value back, re-checking every field (a tampered cookie yields only safe values). */
export function decodeAttr(raw: string | undefined): Attribution {
  if (!raw) return {};
  return attributionFrom(new URLSearchParams(raw));
}
