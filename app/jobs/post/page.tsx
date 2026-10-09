import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JobPostForm } from "@/components/jobs/post-form";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Post a job" };

export default async function PostJobPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) redirect("/login?next=/jobs/post");
  const [locations, { data: store }] = await Promise.all([getLocations(), supabase.from("stores").select("name").eq("owner_id", userId).limit(1).maybeSingle()]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{t("job.post.title_page")}</h1>
        <p className="text-muted-foreground">{t("job.post.sub")}</p>
        <p className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark"><ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("job.post.free_note")}</p>
      </header>
      <JobPostForm locations={locations} defaultCompany={store?.name ?? ""} />
    </div>
  );
}
