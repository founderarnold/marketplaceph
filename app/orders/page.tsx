import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPeso, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { STATUS_TONE, whoseTurn } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, summary, quantity, amount, status, is_full_flow, created_at, buyer_id, seller_id, stores ( name, slug )")
    .order("created_at", { ascending: false })
    .limit(100);

  const buyerIds = [...new Set((orders ?? []).filter((o) => o.seller_id === me).map((o) => o.buyer_id))];
  const { data: buyers } = buyerIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", buyerIds) : { data: [] };
  const buyerName = new Map((buyers ?? []).map((b) => [b.id, b.display_name]));

  type Row = NonNullable<typeof orders>[number];
  const Item = ({ o, role }: { o: Row; role: "buyer" | "seller" }) => {
    const turn = whoseTurn(o.status, role);
    return (
      <li>
        <Link href={`/orders/${o.id}`} className="block space-y-1 rounded-2xl border border-border bg-white p-3 transition-shadow hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{o.summary}</p>
            <Badge tone={STATUS_TONE[o.status]}>{t(`order.status.${o.status}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {role === "buyer" ? o.stores.name : (buyerName.get(o.buyer_id) ?? t("chat.buyer"))} · {o.quantity} × · {o.amount > 0 ? formatPeso(o.amount) : t("cart.price_pending")} · {timeAgo(o.created_at)}
            {!o.is_full_flow && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">{t("order.recorded_deal")}</span>}
          </p>
          {turn && <p className="text-xs font-bold text-accent-strong">● {t("order.your_turn")}</p>}
        </Link>
      </li>
    );
  };

  const asBuyer = (orders ?? []).filter((o) => o.buyer_id === me);
  const asSeller = (orders ?? []).filter((o) => o.seller_id === me);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("orders.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("orders.intro")}</p>
      </div>
      <section aria-labelledby="ob">
        <h2 id="ob" className="mb-2 text-lg font-bold text-brand-dark">{t("deal.as_buyer")}</h2>
        {asBuyer.length ? <ul className="space-y-3">{asBuyer.map((o) => <Item key={o.id} o={o} role="buyer" />)}</ul> : <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("orders.empty_buyer")}</p>}
      </section>
      <section aria-labelledby="os">
        <h2 id="os" className="mb-2 text-lg font-bold text-brand-dark">{t("deal.as_seller")}</h2>
        {asSeller.length ? <ul className="space-y-3">{asSeller.map((o) => <Item key={o.id} o={o} role="seller" />)}</ul> : <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("deal.empty_seller")}</p>}
      </section>
    </div>
  );
}
