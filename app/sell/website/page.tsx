import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Suspense } from "react";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/affiliates/affiliate-forms";
import { NoStore, ProNote } from "@/components/business/pro-note";
import { ToolGuide } from "@/components/sell/tool-guide";
import { ToolHeader } from "@/components/sell/tool-header";
import { buttonClass } from "@/components/ui/button";
import { siteUrl } from "@/lib/affiliate";
import { businessContext } from "@/lib/business";

export const metadata: Metadata = { title: "Mini website" };

/** Mini Website settings: the link to share, a preview, and a checklist of the store-profile details the site shows. */
async function WebsitePageContent() {
  const { supabase, can, store, t } = await businessContext();
  const allowed = can("mini_site");
  if (!store) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <ToolHeader toolKey="mini_site" t={t} />
        <NoStore t={t} />
      </div>
    );
  }
  const [{ data: s }, { count }] = await Promise.all([
    supabase.from("stores").select("logo_url, tagline, description, contact_phone, facebook_url").eq("id", store.id).single(),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("store_id", store.id).eq("status", "active"),
  ]);
  const url = `${siteUrl()}/site/${store.slug}`;
  const checks = [
    { done: !!s?.logo_url, label: t("site.check_logo") },
    { done: !!s?.tagline, label: t("site.check_tagline") },
    { done: !!s?.description, label: t("site.check_about") },
    { done: !!s?.contact_phone, label: t("site.check_phone") },
    { done: (count ?? 0) > 0, label: t("site.check_products") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ToolHeader toolKey="mini_site" t={t} />
      <ToolGuide toolKey="mini_site" t={t} open={!allowed} />
      {!allowed ? (
        <ProNote t={t} need="mini_site" feature={t("sell.locked_body")} />
      ) : (
        <>
          <section aria-labelledby="link-h" className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <h2 id="link-h" className="font-bold text-brand-dark">{t("site.your_link")}</h2>
            <CopyLink url={url} />
            <a href={`/site/${store.slug}`} target="_blank" rel="noopener" className={buttonClass("primary", "md", "gap-2")}>
              <ExternalLink size={18} aria-hidden /> {t("site.preview")}
            </a>
            <p className="text-sm text-muted-foreground">{t("site.share_hint")}</p>
          </section>
          <section aria-labelledby="chk-h" className="space-y-2 rounded-2xl border border-border bg-white p-4">
            <h2 id="chk-h" className="font-bold text-brand-dark">{t("site.checklist")}</h2>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-sm">
                  {c.done ? <CheckCircle2 size={18} className="text-success" aria-hidden /> : <Circle size={18} className="text-muted-foreground" aria-hidden />}
                  <span className={c.done ? "text-muted-foreground" : "font-semibold"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/my/store" className={buttonClass("outline", "md")}>{t("store.edit_link")}</Link>
              <Link href="/sell/new" className={buttonClass("outline", "md")}>{t("nav.post_free")}</Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function WebsitePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WebsitePageContent />
    </Suspense>
  );
}
