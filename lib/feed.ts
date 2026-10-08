import { siteUrl } from "@/lib/affiliate";
import { FEATURE_MIN_RANK } from "@/lib/plans";
import { imageUrl } from "@/lib/images";
import { createPublicClient } from "@/lib/supabase/server";

export type FeedItem = {
  id: string;
  title: string;
  description: string;
  price_type: string;
  price_min: number | null;
  price_max: number | null;
  currency: "PHP";
  unit: string;
  moq: number;
  availability: string; // in_stock | made_to_order | pre_order | out_of_stock
  quantity: number | null;
  category: string;
  url: string;
  image_url: string;
  store: string;
};

export type Feed = { store: { id: string; slug: string; name: string; logo: string | null; url: string }; items: FeedItem[] };

const abs = (u: string) => (u.startsWith("http") ? u : `${siteUrl()}${u}`);

/**
 * Public product feed for one store (active listings only; no personal data).
 * "forbidden" = the store's owner is not on a plan that includes feeds / embeds; null = no such store.
 */
export async function loadFeed(slug: string, opts: { limit?: number; feature?: "feed_export" | "embed" } = {}): Promise<Feed | "forbidden" | null> {
  const supabase = createPublicClient();
  const { data: store } = await supabase.from("stores").select("id, slug, name, logo_url").eq("slug", slug).maybeSingle();
  if (!store) return null;
  const { data: allowed } = await supabase.rpc("store_has_tier", { p_store: store.id, p_min: FEATURE_MIN_RANK[opts.feature ?? "feed_export"] });
  if (!allowed) return "forbidden";

  const { data } = await supabase
    .from("listings")
    .select("id, title, description, price_type, price_min, price_max, unit, moq, stock_status, quantity_on_hand, categories ( name_en ), listing_images ( path, position )")
    .eq("store_id", store.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 1000);

  const items: FeedItem[] = (data ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    description: (l.description ?? "").slice(0, 1000),
    price_type: l.price_type,
    price_min: l.price_min == null ? null : Number(l.price_min),
    price_max: l.price_max == null ? null : Number(l.price_max),
    currency: "PHP",
    unit: l.unit,
    moq: l.moq,
    availability: l.stock_status,
    quantity: l.quantity_on_hand,
    category: l.categories?.name_en ?? "",
    url: `${siteUrl()}/listing/${l.id}`,
    image_url: abs(imageUrl([...l.listing_images].sort((a, b) => a.position - b.position)[0]?.path ?? null)),
    store: store.name,
  }));
  return { store: { id: store.id, slug: store.slug, name: store.name, logo: store.logo_url ? abs(imageUrl(store.logo_url, "store-assets")) : null, url: `${siteUrl()}/store/${store.slug}` }, items };
}
