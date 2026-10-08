import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Fn = Database["public"]["Functions"];
export type StoreTrust = Fn["store_trust"]["Returns"][number];
export type UserTrust = Fn["user_trust"]["Returns"][number];

/** Need this many recent chats before a response rate is shown (avoids "100%" from one conversation). */
export const MIN_RESPONSE_SAMPLE = 5;

export async function loadStoreTrust(supabase: SupabaseClient<Database>, storeId: string) {
  const [trust, badges, flag] = await Promise.all([
    supabase.rpc("store_trust", { p_store: storeId }),
    supabase.rpc("store_badges", { p_store: storeId }),
    supabase.rpc("store_flag", { p_store: storeId }),
  ]);
  return { trust: trust.data?.[0] ?? null, badges: (badges.data ?? []) as string[], flaggedAt: (flag.data as string | null) ?? null };
}

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
  reviewer_name: string;
};

/** Public reviews with the reviewer's display name (public view only). */
export async function loadReviews(
  supabase: SupabaseClient<Database>,
  filter: { storeId?: string; revieweeId?: string; direction: "buyer_to_seller" | "seller_to_buyer" },
  limit = 20,
): Promise<ReviewRow[]> {
  let q = supabase
    .from("reviews")
    .select("id, rating, comment, photos, created_at, reviewer_id")
    .eq("direction", filter.direction)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter.storeId) q = q.eq("store_id", filter.storeId);
  if (filter.revieweeId) q = q.eq("reviewee_id", filter.revieweeId);
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((r) => r.reviewer_id))];
  const { data: names } = ids.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const byId = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  return (data ?? []).map((r) => ({ ...r, reviewer_name: byId.get(r.reviewer_id) ?? "—" }));
}
