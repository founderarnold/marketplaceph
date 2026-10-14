import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { RequestForm } from "@/components/requests/request-forms";
import { getCategories, getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post what you need" };

async function NewRequest() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login?next=/looking-for/new");
  const [{ t }, categories, locations] = await Promise.all([getT(), getCategories(), getLocations()]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/looking-for" className="text-sm font-semibold text-brand hover:underline">← {t("rq.board_title")}</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-dark">{t("rq.new_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("rq.new_intro")}</p>
      </div>
      <RequestForm categories={categories} locations={locations} />
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewRequest />
    </Suspense>
  );
}
