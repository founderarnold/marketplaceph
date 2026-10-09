"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PRICE_TYPES, SELLER_TYPES, STOCK_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

/** `values` echoes the submitted fields so the form can repopulate (React resets uncontrolled forms after an action). */
export type FormState = { error?: string; values?: Record<string, string> } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/sell/new");
  return { supabase, userId };
}

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base.length >= 3 ? base : `store-${base}`.slice(0, 50);
}

const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  seller_type: z.enum(SELLER_TYPES),
  region_code: z.string().min(1),
  province_code: z.preprocess(emptyToNull, z.string().nullable()),
  city_code: z.string().min(1),
  tagline: optionalText(160),
  contact_phone: optionalText(20),
  year_started: z.preprocess(emptyToNull, z.coerce.number().int().min(1900).max(new Date().getFullYear()).nullable()),
});

export async function createStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();
  const raw = Object.fromEntries(formData);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = storeSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("createStore: validation failed", parsed.error.issues);
    return { error: "invalid", values };
  }

  const base = slugify(parsed.data.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("stores").insert({ ...parsed.data, owner_id: userId, slug });
    if (!error) {
      revalidatePath("/sell/new");
      redirect("/sell/new");
    }
    if (error.code !== "23505") {
      console.error("createStore: insert failed", error);
      return { error: "failed", values }; // only slug collisions are retried
    }
  }
  return { error: "failed", values };
}

const listingSchema = z
  .object({
    kind: z.enum(["product", "service"]),
    title: z.string().trim().min(3).max(120),
    description: optionalText(5000),
    category_id: z.uuid(),
    price_type: z.enum(PRICE_TYPES),
    price_min: z.number().min(0).max(5_000_000_000).nullable(),
    price_max: z.number().min(0).max(5_000_000_000).nullable(),
    unit: z.string().trim().min(1).max(20),
    moq: z.number().int().min(1).max(1_000_000),
    stock_status: z.enum(STOCK_STATUSES),
    condition: z.enum(["new", "used", "refurbished", "surplus"]).default("new"),
    quantity_on_hand: z.number().int().min(0).max(10_000_000).nullable(),
    region_code: z.string().min(1),
    province_code: z.string().nullable(),
    city_code: z.string().min(1),
    images: z.array(z.string().min(3).max(300)).min(1).max(8),
    tiers: z.array(z.object({ min_qty: z.number().int().min(2), unit_price: z.number().min(0) })).max(5),
  })
  .refine((v) => (v.price_type === "message" ? true : v.price_min != null), { path: ["price_min"] })
  .refine((v) => (v.price_type === "range" ? v.price_max != null && v.price_max >= (v.price_min ?? 0) : true), { path: ["price_max"] });

export type ListingInput = z.input<typeof listingSchema>;

export async function createListing(input: ListingInput): Promise<{ error?: string; id?: string }> {
  const { supabase, userId } = await requireUser();
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  // Only accept image paths inside the caller's own storage folder (or none from outside).
  if (v.images.some((p) => !p.startsWith(`${userId}/`))) return { error: "invalid" };

  const { data: store } = await supabase.from("stores").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  if (!store) return { error: "no_store" };

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({
      store_id: store.id,
      category_id: v.category_id,
      kind: v.kind,
      title: v.title,
      description: v.description,
      price_type: v.price_type,
      price_min: v.price_type === "message" ? null : v.price_min,
      price_max: v.price_type === "range" ? v.price_max : null,
      unit: v.unit,
      moq: v.moq,
      stock_status: v.stock_status,
      condition: v.condition,
      quantity_on_hand: v.quantity_on_hand,
      region_code: v.region_code,
      province_code: v.province_code,
      city_code: v.city_code,
    })
    .select("id")
    .single();
  if (error || !listing) {
    if (error?.code === "P0003") return { error: "plan_limit" };   // listing cap for the member's FLAME tier
    if (error?.message.includes("cannot be listed")) return { error: error.message };
    if (error?.message.includes("limit")) return { error: "limit" };
    return { error: "failed" };
  }

  await supabase.from("listing_images").insert(v.images.map((path, position) => ({ listing_id: listing.id, path, position })));
  if (v.tiers.length) {
    await supabase
      .from("listing_price_tiers")
      .insert(v.tiers.map((t) => ({ listing_id: listing.id, min_qty: t.min_qty, unit_price: t.unit_price })));
  }
  revalidateTag("listings", "max");
  redirect(`/listing/${listing.id}`);
}

const idSchema = z.uuid();

export async function updateListingStock(listingId: string, stock_status: string, quantity: number | null) {
  const { supabase } = await requireUser();
  const parsed = z
    .object({ id: idSchema, status: z.enum(STOCK_STATUSES), qty: z.number().int().min(0).max(10_000_000).nullable() })
    .safeParse({ id: listingId, status: stock_status, qty: quantity });
  if (!parsed.success) return { ok: false };
  const { error } = await supabase
    .from("listings")
    .update({ stock_status: parsed.data.status, quantity_on_hand: parsed.data.qty })
    .eq("id", parsed.data.id);
  revalidateTag("listings", "max");
  revalidatePath("/my/listings");
  return { ok: !error };
}

export async function setListingVisibility(listingId: string, status: "active" | "hidden") {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(listingId).success || !["active", "hidden"].includes(status)) return { ok: false };
  const { error } = await supabase.from("listings").update({ status }).eq("id", listingId);
  revalidateTag("listings", "max");
  revalidatePath("/my/listings");
  return { ok: !error };
}

export async function deleteListing(listingId: string) {
  const { supabase } = await requireUser();
  if (!idSchema.safeParse(listingId).success) return { ok: false };
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  revalidateTag("listings", "max");
  revalidatePath("/my/listings");
  return { ok: !error };
}

/* ───────── Store profile (links, contact, logo) ───────── */
const httpUrl = (max: number) =>
  z.preprocess(emptyToNull, z.url({ protocol: /^https?$/ }).max(max).nullable());

const storeProfileSchema = z.object({
  tagline: optionalText(160),
  description: optionalText(2000),
  contact_phone: optionalText(20),
  contact_email: z.preprocess(emptyToNull, z.email().max(120).nullable()),
  facebook_url: httpUrl(200),
  website_url: httpUrl(200),
});

export async function updateStore(logo: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, userId } = await requireUser();
  const raw = Object.fromEntries(formData);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = storeProfileSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", values };
  if (logo && !logo.startsWith(`${userId}/`)) return { error: "invalid", values };   // only your own storage folder
  const { data: store, error } = await supabase
    .from("stores")
    .update({ ...parsed.data, logo_url: logo })
    .eq("owner_id", userId)
    .select("slug")
    .maybeSingle();
  if (error || !store) return { error: "failed", values };
  revalidateTag(`store-${store.slug}`, "max");
  revalidatePath(`/store/${store.slug}`);
  revalidatePath("/my/store");
  return { values: { saved: "1", ...values } };
}

/* ───────── Affiliate commission on a listing (seller) ───────── */
export async function setListingCommission(listingId: string, pct: number | null): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireUser();
  const p = z.object({ id: idSchema, pct: z.number().min(1).max(50).nullable() }).safeParse({ id: listingId, pct });
  if (!p.success) return { ok: false, error: "invalid" };
  const { error } = await supabase.rpc("set_listing_commission", { p_listing: p.data.id, p_pct: p.data.pct ?? undefined });
  revalidatePath("/my/listings");
  revalidatePath(`/listing/${p.data.id}`);
  return error ? { ok: false, error: "failed" } : { ok: true };
}
