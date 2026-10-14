import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ListingForm, type ListingInitial } from "@/components/sell/listing-form";
import { getCategories, getLocations } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit listing" };

export default function EditListingPage(props: PageProps<"/sell/edit/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-[40rem] max-w-2xl animate-pulse rounded-3xl bg-muted" />}>
      <Edit params={props.params} />
    </Suspense>
  );
}

async function Edit({ params }: Pick<PageProps<"/sell/edit/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect(`/login?next=/sell/edit/${id}`);

  const [locations, categories, { data: l }] = await Promise.all([
    getLocations(),
    getCategories(),
    supabase
      .from("listings")
      .select(
        `id, kind, title, description, category_id, price_type, price_min, price_max, unit, moq, stock_status, condition, quantity_on_hand,
         region_code, province_code, city_code, status, stores!inner ( owner_id ), listing_images ( path, position ), listing_price_tiers ( min_qty, unit_price )`,
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!l || l.stores.owner_id !== userId || l.status === "removed") notFound();

  const initial: ListingInitial = {
    id: l.id,
    kind: l.kind as ListingInitial["kind"],
    title: l.title,
    description: l.description,
    category_id: l.category_id ?? "",
    price_type: l.price_type as ListingInitial["price_type"],
    price_min: l.price_min,
    price_max: l.price_max,
    unit: l.unit,
    moq: l.moq,
    stock_status: l.stock_status as ListingInitial["stock_status"],
    condition: l.condition as ListingInitial["condition"],
    quantity_on_hand: l.quantity_on_hand,
    region_code: l.region_code ?? "",
    province_code: l.province_code,
    city_code: l.city_code ?? "",
    images: [...l.listing_images].sort((a, b) => a.position - b.position).map((i) => i.path),
    tiers: [...l.listing_price_tiers].sort((a, b) => a.min_qty - b.min_qty),
  };
  return <ListingForm userId={userId} categories={categories} locations={locations} storeLocation={{ region: null, province: null, city: null }} initial={initial} />;
}
