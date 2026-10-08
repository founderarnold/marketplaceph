import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreProfileForm } from "@/components/sell/store-profile-form";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit store" };

export default async function EditStorePage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/my/store");

  const { data: store } = await supabase
    .from("stores")
    .select("slug, name, tagline, description, contact_phone, contact_email, facebook_url, website_url, logo_url")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (!store) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-3xl bg-muted p-8 text-center">
        <p>{t("my.no_store")}</p>
        <Link href="/sell/new" className={buttonClass("accent", "lg")}>{t("nav.post_free")}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href={`/store/${store.slug}`} className="text-sm font-semibold text-brand hover:underline">{t("my.view_store")}</Link>
      <StoreProfileForm userId={userId} store={store} />
    </div>
  );
}
