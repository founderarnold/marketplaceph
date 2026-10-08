import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { canUse, tierByRank, type Feature } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

/** Who is asking, which FLAME tier are they on, and do they have a store? Shared by every /business page. */
export async function businessContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/business");
  const [{ data: mine }, { data: store }, tr] = await Promise.all([
    supabase.rpc("my_tier"),
    supabase.from("stores").select("id, name, slug").eq("owner_id", userId).limit(1).maybeSingle(),
    getT(),
  ]);
  const rank = mine?.[0]?.rank ?? 0;
  const tier = tierByRank(rank);
  const can = (f: Feature) => canUse(rank, f);
  return { supabase, userId, rank, tier, can, periodEnd: mine?.[0]?.period_end ?? null, store, t: tr.t, locale: tr.locale };
}

export const peso = (n: number | string | null | undefined) => "₱" + Number(n ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function daysAgoIso(n: number, now = new Date()) {
  return isoDay(new Date(now.getTime() - n * 86_400_000));
}
