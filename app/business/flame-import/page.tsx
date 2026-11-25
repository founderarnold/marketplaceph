import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FlameImportForm } from "@/components/business/flame-import-form";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buttonClass } from "@/components/ui/button";
import { myFlameBusinesses } from "@/lib/flame-business";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bring my FLAME PH business", robots: { index: false } };

/**
 * "Bring my FLAME PH business": a member who signed in with their FLAME PH account picks one of THEIR OWN flameph.org
 * listings, previews it and agrees; their MarketplacePH store is created or updated. "Sync again" refreshes it later.
 */
async function FlameImport() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/business/flame-import");

  const [res, { data: stores }, { data: links }] = await Promise.all([
    myFlameBusinesses(userId),
    supabase.from("stores").select("id").eq("owner_id", userId).limit(1),
    (supabase as unknown as SupabaseClient).from("flame_business_links").select("flame_business_id, last_synced_at").eq("user_id", userId),
  ]);
  const linked = ((links ?? []) as { flame_business_id: string; last_synced_at: string }[]);
  const list = res.status === "ok" ? res.businesses : [];

  return (
    <div className="space-y-4 py-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("fbiz.title")}</h1>
        <p className="text-muted-foreground">{t("fbiz.sub")}</p>
      </header>
      {res.status === "not_linked" || res.status === "sso_off" ? (
        <div className="space-y-3 rounded-2xl bg-muted p-4">
          <p>{res.status === "sso_off" ? t("fbiz.sso_off") : t("fbiz.not_linked")}</p>
          {res.status === "not_linked" && <a href="/auth/flame/start?next=%2Fbusiness%2Fflame-import" className={buttonClass("primary", "md")}>{t("fbiz.signin_flame")}</a>}
        </div>
      ) : res.status === "unreachable" ? (
        <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-danger">{t("fbiz.unreachable")}</p>
      ) : list.length === 0 ? (
        <div className="space-y-3 rounded-2xl bg-muted p-4">
          <p>{t("fbiz.none")}</p>
          <a href="https://www.flameph.org/directory" target="_blank" rel="noopener" className={buttonClass("outline", "md")}>{t("fbiz.list_on_flame")}</a>
        </div>
      ) : (
        <FlameImportForm businesses={list} hasStore={!!stores?.length} linkedIds={linked.map((l) => l.flame_business_id)} />
      )}
      <p className="text-xs text-muted-foreground">{t("fbiz.privacy")}</p>
      <Link href="/business" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline">← {t("fbiz.back")}</Link>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FlameImport />
    </Suspense>
  );
}
