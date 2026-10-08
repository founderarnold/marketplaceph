import { NextResponse, type NextRequest } from "next/server";
import { loadFeed } from "@/lib/feed";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Data for the embeddable widget (public/embed.js): store info and up to 8 in-stock products. Needs FLAME Neo or higher. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/embed/[slug]">) {
  const { slug } = await ctx.params;
  const feed = await loadFeed(slug, { limit: 8, feature: "embed" });
  if (feed === null) return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS });
  if (feed === "forbidden") return NextResponse.json({ error: "plan" }, { status: 403, headers: CORS });
  const items = feed.items.filter((i) => i.availability !== "out_of_stock").map((i) => ({ title: i.title, url: i.url, image: i.image_url, price_type: i.price_type, price_min: i.price_min, price_max: i.price_max, unit: i.unit }));
  void request;
  return NextResponse.json({ store: { name: feed.store.name, url: feed.store.url, logo: feed.store.logo }, items }, { headers: CORS });
}
