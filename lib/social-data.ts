import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type FriendInfo = { friends: number; following: number; suki: number; added: boolean };
export type UserBadgeInfo = { badges: string[]; yearsSince: number | null };

/** Friend totals for a person, and whether the viewer has added them. */
export async function loadFriendInfo(supabase: Supabase, target: string, viewer: string | null): Promise<FriendInfo> {
  const [{ data: counts }, added] = await Promise.all([
    supabase.rpc("friend_counts", { p_user: target }),
    viewer && viewer !== target
      ? supabase.from("follows").select("followee_id").eq("follower_id", viewer).eq("followee_id", target).maybeSingle().then((r) => !!r.data)
      : Promise.resolve(false),
  ]);
  const c = counts?.[0];
  return { friends: c?.friends ?? 0, following: c?.following ?? 0, suki: c?.suki ?? 0, added };
}

/** Admin-approved badges for a person (plus the business start year when "years in business" is verified). */
export async function loadUserBadges(supabase: Supabase, user: string, yearStarted?: number | null): Promise<UserBadgeInfo> {
  const { data } = await supabase.from("user_badges").select("badge").eq("user_id", user);
  const badges = (data ?? []).map((b) => b.badge);
  return { badges, yearsSince: badges.includes("years_verified") && yearStarted ? yearStarted : null };
}

export type TxCounts = { sold: number; bought: number; hired: number; hires: number };

/** Completed transactions: sold / bought (completed orders), jobs done as applicant and hires made as employer (confirmed). */
export async function loadTxCounts(supabase: Supabase, user: string): Promise<TxCounts> {
  const { data } = await supabase.rpc("transaction_counts", { p_user: user });
  const c = data?.[0];
  return { sold: c?.sold ?? 0, bought: c?.bought ?? 0, hired: c?.hired ?? 0, hires: c?.hires ?? 0 };
}
