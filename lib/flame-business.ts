import "server-only";
import { cookies } from "next/headers";
import { LINK_COOKIE, hubCall, readLink, ssoEnabled } from "@/lib/flame-sso";

/**
 * "Bring my FLAME PH business": reads the signed-in member's OWN business listings from flameph.org.
 * Uses the existing signed server-to-server call (hubCall) with its own purpose "business-share" and the member's
 * pairwise id from the signed FLAME PH link cookie. Only members who signed in with their FLAME PH account have that
 * cookie, so nobody can ask about another member. This file only reads; it never changes how sign-in works.
 */
export type FlameBusiness = {
  id: string; name: string | null; slug: string; sector: string | null; subsector: string | null; description: string | null;
  products: string | null; city: string | null; province: string | null; region: string | null; phone: string | null; email: string | null;
  messenger: string | null; viber: string | null; hours: string | null; facebookUrl: string | null; logoUrl: string | null;
  coverUrl: string | null; photoUrls: string[]; profileUrl: string; updatedAt: string;
};

export type FlameBusinessesResult =
  | { status: "ok"; businesses: FlameBusiness[] }
  | { status: "sso_off" | "not_linked" | "unreachable" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,100}$/;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const https = (v: unknown) => (typeof v === "string" && /^https:\/\/[^\s"<>]+$/.test(v) && v.length <= 600 ? v : null);

/** Checks every field of the hub's answer again here; anything unexpected is dropped. Exported for tests. */
export function cleanBusiness(raw: unknown, userLinked = true): FlameBusiness | null {
  if (!userLinked || !raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.id !== "string" || !UUID.test(b.id) || typeof b.slug !== "string" || !SLUG.test(b.slug)) return null;
  return {
    id: b.id, slug: b.slug,
    name: str(b.name, 80), sector: str(b.sector, 80), subsector: str(b.subsector, 80), description: str(b.description, 2000),
    products: str(b.products, 1000), city: str(b.city, 80), province: str(b.province, 80), region: str(b.region, 80),
    phone: str(b.phone, 20), email: str(b.email, 120), messenger: str(b.messenger, 200), viber: str(b.viber, 30), hours: str(b.hours, 200),
    facebookUrl: https(b.facebookUrl), logoUrl: https(b.logoUrl), coverUrl: https(b.coverUrl),
    photoUrls: Array.isArray(b.photoUrls) ? b.photoUrls.map(https).filter((x): x is string => !!x).slice(0, 6) : [],
    profileUrl: https(b.profileUrl) ?? `https://www.flameph.org/members/${b.slug}`,
    updatedAt: typeof b.updatedAt === "string" ? b.updatedAt : "",
  };
}

/** The member's own FLAME PH business listings, or why they can't be read right now. */
export async function myFlameBusinesses(userId: string): Promise<FlameBusinessesResult> {
  if (!ssoEnabled()) return { status: "sso_off" };
  const link = readLink((await cookies()).get(LINK_COOKIE)?.value);
  // The link cookie must belong to the member who is signed in here.
  if (!link || link.uid !== userId) return { status: "not_linked" };
  const res = await hubCall<{ businesses?: unknown[] }>("/api/ecosystem/my-businesses", "business-share", { sub: link.sub }, 8000);
  if (!res || !Array.isArray(res.businesses)) return { status: "unreachable" };
  return { status: "ok", businesses: res.businesses.map((b) => cleanBusiness(b)).filter((b): b is FlameBusiness => !!b && !!b.name) };
}
