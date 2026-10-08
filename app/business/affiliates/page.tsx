import type { Metadata } from "next";
import Link from "next/link";
import { CopyLink, DecideButtons, PaidButton, RevokeButton } from "@/components/affiliates/affiliate-forms";
import { Badge } from "@/components/ui/badge";
import { affiliateUrl } from "@/lib/affiliate";
import { businessContext, peso } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Affiliates" };

const card = "rounded-2xl border border-border bg-white p-3 text-sm";
const tone = (s: string) => (s === "approved" || s === "paid" ? "success" : s === "pending" || s === "earned" ? "accent" : "neutral") as "success" | "accent" | "neutral";

export default async function AffiliatesPage() {
  const { supabase, userId, tier, t } = await businessContext();
  const [{ data: mine }, { data: quota }, { data: incoming }, { data: commissions }] = await Promise.all([
    supabase.rpc("affiliate_dashboard"),
    supabase.rpc("affiliate_quota"),
    supabase
      .from("affiliate_links")
      .select("id, status, rate, message, created_at, affiliate_id, listings ( title )")
      .eq("seller_id", userId)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false }),
    supabase
      .from("affiliate_commissions")
      .select("id, order_id, affiliate_id, rate, amount, status, created_at, paid_at, listings ( title )")
      .eq("seller_id", userId)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const ids = [...new Set([...(incoming ?? []).map((l) => l.affiliate_id), ...(commissions ?? []).map((c) => c.affiliate_id)])];
  const { data: names } = ids.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name ?? "—"]));

  const used = quota?.[0]?.used ?? 0;
  const limit = quota?.[0]?.quota ?? tier.affiliateLinks;
  const owed = (commissions ?? []).filter((c) => c.status === "earned").reduce((s, c) => s + Number(c.amount), 0);
  const paid = (commissions ?? []).filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const pending = (incoming ?? []).filter((l) => l.status === "pending");
  const approved = (incoming ?? []).filter((l) => l.status === "approved");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("aff.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("aff.intro")}</p>
      </div>

      {/* ───── As an affiliate ───── */}
      <section className="space-y-3" aria-labelledby="mine-h">
        <h2 id="mine-h" className="text-lg font-bold text-brand-dark">{t("aff.my_links")}</h2>
        <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
          {t("aff.quota", { used, limit })} {used >= limit && <Link href="/business/plan" className="font-semibold underline">{t("plan.upgrade")}</Link>}
        </p>
        {!mine?.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("aff.none_mine")}</p>}
        <ul className="space-y-2">
          {mine?.map((k) => (
            <li key={k.link_id} className={`${card} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/listing/${k.listing_id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">{k.listing_title}</Link>
                <Badge tone={tone(k.status)}>{t(`aff.status.${k.status}`)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{k.store_name}{k.rate != null ? ` · ${k.rate}%` : ""}</p>
              {k.status === "approved" && (
                <>
                  <CopyLink url={affiliateUrl(k.code)} />
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {([
                      [t("aff.clicks"), String(k.clicks)],
                      [t("aff.orders"), String(k.orders)],
                      [t("aff.pending"), peso(k.pending)],
                      [t("aff.earned"), peso(k.earned)],
                      [t("aff.paid"), peso(k.paid)],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-muted p-2">
                        <dt className="text-[11px] text-muted-foreground">{label}</dt>
                        <dd className="font-extrabold text-brand-dark">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {(k.status === "approved" || k.status === "pending") && <RevokeButton linkId={k.link_id} />}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("aff.payout_note")}</p>
      </section>

      {/* ───── As a seller ───── */}
      <section className="space-y-3" aria-labelledby="sell-h">
        <h2 id="sell-h" className="text-lg font-bold text-brand-dark">{t("aff.seller_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("aff.seller_hint")} <Link href="/my/listings" className="font-semibold text-brand underline">{t("aff.set_commission")}</Link></p>

        <h3 className="font-bold">{t("aff.requests")} ({pending.length})</h3>
        {!pending.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("aff.none_requests")}</p>}
        <ul className="space-y-2">
          {pending.map((l) => (
            <li key={l.id} className={`${card} space-y-2`}>
              <p><b>{nm.get(l.affiliate_id)}</b> <span className="text-xs text-muted-foreground">· {timeAgo(l.created_at)}</span></p>
              <p className="text-muted-foreground">{l.listings?.title}</p>
              {l.message && <p>“{l.message}”</p>}
              <DecideButtons linkId={l.id} />
            </li>
          ))}
        </ul>

        <h3 className="font-bold">{t("aff.approved_list")} ({approved.length})</h3>
        <ul className="space-y-2">
          {approved.map((l) => (
            <li key={l.id} className={`${card} flex flex-wrap items-center gap-2`}>
              <span className="min-w-0 flex-1 truncate"><b>{nm.get(l.affiliate_id)}</b> · {l.listings?.title} · {l.rate}%</span>
              <RevokeButton linkId={l.id} />
            </li>
          ))}
        </ul>

        <h3 className="font-bold">{t("aff.commissions")}</h3>
        <p className="text-sm">{t("aff.owed", { owed: peso(owed), paid: peso(paid) })}</p>
        {!commissions?.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("aff.none_commissions")}</p>}
        <ul className="space-y-2">
          {commissions?.map((c) => (
            <li key={c.id} className={`${card} flex flex-wrap items-center gap-2`}>
              <span className="min-w-0 flex-1">
                <b>{nm.get(c.affiliate_id)}</b> · {c.listings?.title ?? "—"} · {c.rate}%{" "}
                <Link href={`/orders/${c.order_id}`} className="text-xs text-brand underline">#{c.order_id.slice(0, 6).toUpperCase()}</Link>
              </span>
              <Badge tone={tone(c.status)}>{t(`aff.cstatus.${c.status}`)}</Badge>
              <span className="font-extrabold">{c.status === "pending" ? "—" : peso(c.amount)}</span>
              {c.status === "earned" && <PaidButton commissionId={c.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
