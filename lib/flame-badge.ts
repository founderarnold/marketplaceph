import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { hubCall, ssoEnabled } from "@/lib/flame-sso";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The seller's FLAME PH badge (consent 3), from flameph.org. flameph.org decides everything (its off switch, consent 3,
 * 3 months of account age, counted records) and sends only: verified, level, counted records, category mix, member
 * since. Kept here at most 10 minutes, and dropped at once when flameph.org sends a notice (see /auth/flame/notice).
 */
export type FlameBadge = { level: string; verified: boolean; counted: number; categories: Record<string, number>; memberSince: string | null };
export const FLAME_BADGE_TAG = "flame-badges";

export async function loadFlameBadge(ownerId: string): Promise<FlameBadge | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 600 });
  cacheTag(FLAME_BADGE_TAG);
  if (!ssoEnabled()) return null;
  // The seller's private FLAME PH code for this site, saved when they signed in with FLAME PH.
  const { data } = await createAdminClient().auth.admin.getUserById(ownerId);
  const sub = data?.user?.app_metadata?.flame_sub;
  if (typeof sub !== "string") return null;
  const res = await hubCall<{ badges?: { sub: string; shown: boolean; level?: string; verified?: boolean; counted?: number; categories?: Record<string, number>; memberSince?: string | null }[] }>(
    "/api/ecosystem/badges", "badges", { subs: [sub] },
  );
  const b = res?.badges?.find((x) => x.sub === sub);
  if (!b?.shown || !b.level) return null;
  return { level: b.level, verified: !!b.verified, counted: b.counted ?? 0, categories: b.categories ?? {}, memberSince: b.memberSince ?? null };
}
