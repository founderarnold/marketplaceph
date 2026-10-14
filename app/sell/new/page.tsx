import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/sell/listing-form";
import { StoreSetupForm } from "@/components/sell/store-setup-form";
import { ToolGuide } from "@/components/sell/tool-guide";
import { getT } from "@/lib/i18n/server";
import { getCategories, getLocations } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post for FREE" };

async function NewListingPageContent() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/sell/new");

  const [{ t }, locations, categories, { data: store }] = await Promise.all([
    getT(),
    getLocations(),
    getCategories(),
    supabase.from("stores").select("id, region_code, province_code, city_code").eq("owner_id", userId).limit(1).maybeSingle(),
  ]);

  if (!store) return <StoreSetupForm locations={locations} />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ToolGuide toolKey="post" t={t} />
      <ListingForm
      userId={userId}
      categories={categories}
      locations={locations}
        storeLocation={{ region: store.region_code, province: store.province_code, city: store.city_code }}
      />
    </div>
  );
}

export default function NewListingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewListingPageContent />
    </Suspense>
  );
}
