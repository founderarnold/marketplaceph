import { NextResponse, type NextRequest } from "next/server";
import { fileStamp } from "@/lib/export";
import { tablesToCsv } from "@/lib/export-files";
import { loadFeed } from "@/lib/feed";

/**
 * Public product feed: /feed/<store-slug>?format=csv|json
 * Active listings only, no personal data. Available when the store's owner is on FLAME Neo or higher.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/feed/[slug]">) {
  const { slug } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (!["csv", "json"].includes(format)) return new NextResponse("Unknown format", { status: 400 });
  const feed = await loadFeed(slug, { feature: "feed_export" });
  if (feed === null) return new NextResponse("Not found", { status: 404 });
  if (feed === "forbidden") return new NextResponse("This store's plan does not include a product feed.", { status: 403 });

  const headers = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600", "Access-Control-Allow-Origin": "*" };
  const name = `${feed.store.slug}-products-${fileStamp()}`;
  if (format === "json") {
    return NextResponse.json({ store: feed.store, count: feed.items.length, items: feed.items }, { headers: { ...headers, "Content-Disposition": `inline; filename="${name}.json"` } });
  }
  const csv = tablesToCsv([
    {
      title: "Products",
      columns: ["id", "title", "description", "price_type", "price_min", "price_max", "currency", "unit", "moq", "availability", "quantity", "category", "url", "image_url", "store"],
      rows: feed.items.map((i) => [i.id, i.title, i.description, i.price_type, i.price_min, i.price_max, i.currency, i.unit, i.moq, i.availability, i.quantity, i.category, i.url, i.image_url, i.store]),
    },
  ]);
  return new NextResponse(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
