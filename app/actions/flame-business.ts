"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLocations } from "@/lib/data";
import { SELLER_TYPES } from "@/lib/domain";
import { myFlameBusinesses, type FlameBusiness } from "@/lib/flame-business";
import { createClient } from "@/lib/supabase/server";

export type ImportState = { ok?: boolean; storeSlug?: string; created?: boolean; error?: "signin" | "consent" | "invalid" | "not_found" | "not_linked" | "unreachable" | "failed" } | undefined;

function slugify(name: string) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return base.length >= 3 ? base : `store-${base}`.slice(0, 50);
}

/** City / province names from flameph.org -> PSGC codes used by MarketplacePH (null when not found). */
async function placeCodes(b: FlameBusiness) {
  const { cities, provinces } = await getLocations();
  const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/^city of\s+/, "").replace(/\s+city$/, "").trim();
  const prov = provinces.find((p) => b.province && norm(p.name) === norm(b.province)) ?? null;
  const city = cities.find((c) => b.city && norm(c.name) === norm(b.city) && (!prov || c.province_code === prov.code))
    ?? cities.find((c) => b.city && norm(c.name) === norm(b.city)) ?? null;
  return { city_code: city?.code ?? null, province_code: city?.province_code ?? prov?.code ?? null, region_code: city?.region_code ?? prov?.region_code ?? null };
}

/**
 * Creates or updates the signed-in member's MarketplacePH store from THEIR OWN flameph.org listing, after they
 * previewed it and ticked "I agree". The listing is fetched again here on the server (the browser only sends which
 * listing), so nobody can submit someone else's details. One store per FLAME PH listing: a store already linked to
 * this listing, or the member's existing store, is updated instead of making a duplicate.
 */
export async function importFlameBusiness(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return { error: "signin" };
  const p = z.object({
    business_id: z.uuid(),
    seller_type: z.enum(SELLER_TYPES),
    consent: z.literal("on"),
    show_phone: z.literal("on").optional(),
    show_email: z.literal("on").optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: fd.get("consent") !== "on" ? "consent" : "invalid" };

  const res = await myFlameBusinesses(userId);
  if (res.status === "not_linked" || res.status === "sso_off") return { error: "not_linked" };
  if (res.status !== "ok") return { error: "unreachable" };
  const b = res.businesses.find((x) => x.id === p.data.business_id);
  if (!b || !b.name) return { error: "not_found" };

  const db = supabase as unknown as SupabaseClient;
  const places = await placeCodes(b);
  const fields = {
    name: b.name.slice(0, 80),
    tagline: [b.sector, b.subsector].filter(Boolean).join(" · ").slice(0, 160) || null,
    description: b.description?.slice(0, 2000) ?? null,
    logo_url: b.logoUrl,
    facebook_url: b.facebookUrl,
    ...(places.city_code ? places : {}),
    // Contact details are shown on the store only if the owner ticks them.
    ...(p.data.show_phone ? { contact_phone: b.phone } : {}),
    ...(p.data.show_email ? { contact_email: b.email } : {}),
  };

  // Which store: the one already linked to this listing, else the member's oldest store, else a new one.
  const { data: link } = await db.from("flame_business_links").select("store_id").eq("user_id", userId).eq("flame_business_id", b.id).maybeSingle();
  let storeId: string | null = (link as { store_id: string } | null)?.store_id ?? null;
  if (!storeId) {
    const { data: own } = await supabase.from("stores").select("id").eq("owner_id", userId).order("created_at").limit(1).maybeSingle();
    storeId = own?.id ?? null;
  }
  let created = false;
  if (storeId) {
    const { error } = await supabase.from("stores").update(fields).eq("id", storeId).eq("owner_id", userId);
    if (error) return { error: "failed" };
  } else {
    const base = slugify(b.name);
    for (let attempt = 0; attempt < 5 && !storeId; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase.from("stores").insert({ ...fields, owner_id: userId, slug, seller_type: p.data.seller_type }).select("id").single();
      if (data) storeId = data.id;
      else if (error && error.code !== "23505") return { error: "failed" };
    }
    if (!storeId) return { error: "failed" };
    created = true;
  }

  const now = new Date().toISOString();
  const { error: linkError } = await db.from("flame_business_links").upsert(
    { user_id: userId, store_id: storeId, flame_business_id: b.id, flame_slug: b.slug, consent_at: now, last_synced_at: now },
    { onConflict: "store_id" },
  );
  if (linkError) return { error: "failed" };
  const { data: store } = await supabase.from("stores").select("slug").eq("id", storeId).single();
  revalidatePath("/business/flame-import");
  revalidatePath(`/store/${store?.slug ?? ""}`);
  return { ok: true, created, storeSlug: store?.slug };
}
