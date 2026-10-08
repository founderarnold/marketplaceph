import type { Metadata } from "next";
import Link from "next/link";
import { NoStore } from "@/components/business/pro-note";
import { businessContext, peso } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage(props: PageProps<"/business/customers">) {
  const sp = await props.searchParams;
  const tag = typeof sp.tag === "string" ? sp.tag : null;
  const { supabase, store, t } = await businessContext();
  if (!store) return <NoStore t={t} />;
  const { data } = await supabase.rpc("crm_list", { p_store: store.id });
  const all = data ?? [];
  const tags = [...new Set(all.flatMap((c) => c.tags))].sort();
  const list = tag ? all.filter((c) => c.tags.includes(tag)) : all;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("biz.nav.customers")}</h1>
        <p className="text-sm text-muted-foreground">{t("crm.intro")}</p>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={t("crm.tags")}>
          <Link href="/business/customers" className={`rounded-full px-3 py-1 text-xs font-semibold ${!tag ? "bg-brand text-white" : "bg-muted"}`}>{t("filters.all")}</Link>
          {tags.map((x) => (
            <Link key={x} href={`/business/customers?tag=${encodeURIComponent(x)}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${tag === x ? "bg-brand text-white" : "bg-muted"}`}>#{x}</Link>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("crm.empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <li key={c.buyer_id}>
              <Link href={`/business/customers/${c.buyer_id}`} className="block h-full space-y-1 rounded-2xl border border-border bg-white p-4 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-brand-dark">{c.display_name}</p>
                  <p className="font-extrabold">{peso(c.total_spent)}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("crm.orders_n", { n: c.orders_count })} · {t("crm.last", { when: timeAgo(c.last_order_at) })}{c.last_phone ? ` · ${c.last_phone}` : ""}
                </p>
                {c.tags.length > 0 && <p className="flex flex-wrap gap-1">{c.tags.map((x) => <span key={x} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">#{x}</span>)}</p>}
                {c.notes && <p className="line-clamp-2 text-sm">{c.notes}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("crm.privacy")}</p>
    </div>
  );
}
