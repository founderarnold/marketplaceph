import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Data export (RA 10173 right to access): everything we hold about the signed-in user, as JSON. RLS scopes every query. */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub as string | undefined;
  if (!id) return new NextResponse("Unauthorized", { status: 401 });

  const [profile, stores, favorites, conversations, messages, reports] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("stores").select("*").eq("owner_id", id),
    supabase.from("favorites").select("*").eq("user_id", id),
    supabase.from("conversations").select("*"),
    supabase.from("messages").select("*").eq("sender_id", id),
    supabase.from("reports").select("*").eq("reporter_id", id),
  ]);
  const storeIds = (stores.data ?? []).map((s) => s.id);
  const listings = storeIds.length ? await supabase.from("listings").select("*, listing_images(*), listing_price_tiers(*)").in("store_id", storeIds) : { data: [] };

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: { id, email: claims?.claims?.email ?? null, phone: claims?.claims?.phone ?? null },
      profile: profile.data,
      stores: stores.data,
      listings: listings.data,
      favorites: favorites.data,
      conversations: conversations.data,
      messages_sent: messages.data,
      reports_filed: reports.data,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="marketplaceph-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
