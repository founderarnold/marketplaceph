import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/sell/listing-form";
import { StoreSetupForm } from "@/components/sell/store-setup-form";
import { getCategories, getLocations } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post for FREE" };

export default async function NewListingPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/sell/new");

  const [locations, categories, { data: store }] = await Promise.all([
    getLocations(),
    getCategories(),
    supabase.from("stores").select("id, region_code, province_code, city_code").eq("owner_id", userId).limit(1).maybeSingle(),
  ]);

  if (!store) return <StoreSetupForm locations={locations} />;
  return (
    <ListingForm
      userId={userId}
      categories={categories}
      locations={locations}
      storeLocation={{ region: store.region_code, province: store.province_code, city: store.city_code }}
    />
  );
}
