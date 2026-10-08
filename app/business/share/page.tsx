import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink } from "@/components/affiliates/affiliate-forms";
import { NoStore, ProBadge, ProNote } from "@/components/business/pro-note";
import { siteUrl } from "@/lib/affiliate";
import { businessContext } from "@/lib/business";

export const metadata: Metadata = { title: "Share & embed" };

const code = "block overflow-x-auto whitespace-pre rounded-xl bg-muted p-3 text-xs";

/** Storefront link, Facebook / website links, the "Shop on MarketplacePH" button and widget, and the product feed. */
export default async function SharePage() {
  const { supabase, can, store, t } = await businessContext();
  if (!store) return <NoStore t={t} />;
  const { data: links } = await supabase.from("stores").select("facebook_url, website_url").eq("id", store.id).maybeSingle();
  const site = siteUrl();
  const url = `${site}/store/${store.slug}`;
  const snippetButton = `<div data-mph-store="${store.slug}" data-mph-mode="button"></div>\n<script async src="${site}/embed.js"></script>`;
  const snippetWidget = `<div data-mph-store="${store.slug}" data-mph-mode="widget"></div>\n<script async src="${site}/embed.js"></script>`;
  const allowed = can("embed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("share.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("share.intro")}</p>
      </div>

      <section className="space-y-2 rounded-2xl border border-border bg-white p-4" aria-labelledby="url-h">
        <h2 id="url-h" className="font-bold text-brand-dark">{t("share.store_link")}</h2>
        <CopyLink url={url} />
        <ul className="space-y-1 text-sm">
          <li>Facebook: {links?.facebook_url ? <a href={links.facebook_url} className="text-brand underline" rel="noopener noreferrer nofollow" target="_blank">{links.facebook_url}</a> : <span className="text-muted-foreground">{t("share.not_set")}</span>}</li>
          <li>{t("store.website")}: {links?.website_url ? <a href={links.website_url} className="text-brand underline" rel="noopener noreferrer nofollow" target="_blank">{links.website_url}</a> : <span className="text-muted-foreground">{t("share.not_set")}</span>}</li>
        </ul>
        <Link href="/my/store" className="text-sm font-semibold text-brand underline">{t("share.edit_links")}</Link>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-white p-4" aria-labelledby="emb-h">
        <h2 id="emb-h" className="flex items-center gap-2 font-bold text-brand-dark">{t("share.embed_title")} <ProBadge t={t} need="embed" /></h2>
        {!allowed ? (
          <ProNote t={t} need="embed" feature={t("share.locked")} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("share.embed_hint")}</p>
            <h3 className="text-sm font-bold">{t("share.button")}</h3>
            <pre className={code}>{snippetButton}</pre>
            <h3 className="text-sm font-bold">{t("share.widget")}</h3>
            <pre className={code}>{snippetWidget}</pre>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-white p-4" aria-labelledby="feed-h">
        <h2 id="feed-h" className="flex items-center gap-2 font-bold text-brand-dark">{t("share.feed_title")} <ProBadge t={t} need="feed_export" /></h2>
        {!allowed ? (
          <ProNote t={t} need="feed_export" feature={t("share.locked")} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("share.feed_hint")}</p>
            <div className="flex flex-wrap gap-2">
              <a className="btn inline-flex h-10 items-center rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" href={`/feed/${store.slug}?format=csv`} download>CSV</a>
              <a className="btn inline-flex h-10 items-center rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" href={`/feed/${store.slug}?format=json`} target="_blank" rel="noopener">JSON</a>
            </div>
            <CopyLink url={`${site}/feed/${store.slug}?format=json`} />
          </>
        )}
      </section>
    </div>
  );
}
