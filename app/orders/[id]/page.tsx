import { Check, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { DealActions, ReviewForm } from "@/components/deals/deal-forms";
import {
  DisputeOpenForm, DisputeRespondForm, OrderActions, PackForm, PayForm, PaymentReview, QuoteForm, ReorderButton, ShipForm, type MethodLite,
} from "@/components/orders/order-panels";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatPeso, nowMs, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { isPdf, signOrderFiles } from "@/lib/order-files";
import { FLOW, STATUS_TONE, type OrderStatus } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage(props: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Order params={props.params} />
    </Suspense>
  );
}

const card = "space-y-2 rounded-2xl border border-border bg-white p-4";
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : null);

async function Order({ params }: Pick<PageProps<"/orders/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: o } = await supabase
    .from("orders")
    .select("*, stores ( id, name, slug )")
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const role: "buyer" | "seller" | "viewer" = o.buyer_id === me ? "buyer" : o.seller_id === me ? "seller" : "viewer";

  // ---- legacy "recorded deal" (Phase 2): simple confirm / cancel / review ----
  if (!o.is_full_flow) {
    const { data: rev } = await supabase.from("reviews").select("id").eq("order_id", id).eq("reviewer_id", me).maybeSingle();
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/orders" className="text-sm font-semibold text-brand hover:underline">← {t("deal.title")}</Link>
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-extrabold text-brand-dark">{o.summary}</h1>
            <Badge tone={STATUS_TONE[o.status]}>{t(`order.status.${o.status}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{o.stores.name} · {o.quantity} × · {formatPeso(o.amount)} · {timeAgo(o.created_at)}</p>
          <p className="rounded-xl bg-muted p-2 text-xs text-muted-foreground">{t("order.legacy_note")}</p>
          {o.status === "pending_confirmation" && role !== "viewer" && <DealActions orderId={o.id} canConfirm={role === "buyer"} />}
          {o.status === "completed" && role !== "viewer" && (rev ? <p className="text-sm text-success">✓ {t("review.done")}</p> : <ReviewForm orderId={o.id} userId={me} aboutLabel={role === "buyer" ? o.stores.name : t("chat.buyer")} />)}
        </section>
      </div>
    );
  }

  const [{ data: items }, { data: delivery }, { data: proofs }, { data: packs }, { data: ship }, { data: disputes }, { data: myReview }, { data: buyer }] = await Promise.all([
    supabase.from("order_items").select("id, title, unit, quantity, unit_price, available_qty, packed, listing_id").eq("order_id", id).order("created_at"),
    supabase.from("order_delivery").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("payment_proofs").select("id, method, reference_no, amount, proof_path, status, seller_note, created_at").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("packing_proofs").select("id, photo_path, note, created_at").eq("order_id", id).order("created_at"),
    supabase.from("shipments").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("disputes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id").eq("order_id", id).eq("reviewer_id", me).maybeSingle(),
    supabase.from("public_profiles").select("display_name").eq("id", o.buyer_id).maybeSingle(),
  ]);
  const dispute = disputes?.[0] ?? null;
  const { data: evidence } = dispute ? await supabase.from("dispute_evidence").select("id, uploader_id, storage_path, created_at").eq("dispute_id", dispute.id) : { data: [] };

  // private files: signed only for the two parties (paths came from RLS-checked reads above)
  const urls = role === "viewer" ? {} : await signOrderFiles([...(proofs ?? []).map((p) => p.proof_path), ...(packs ?? []).map((p) => p.photo_path), ship?.waybill_path, ...(evidence ?? []).map((e) => e.storage_path)]);

  const items_ = items ?? [];
  const itemsTotal = items_.reduce((s, i) => s + (i.available_qty ?? i.quantity) * (i.unit_price ?? 0), 0);
  const expired = !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < nowMs();
  const myName = role === "buyer" ? o.stores.name : (buyer?.display_name ?? t("chat.buyer"));

  // shipping method choices for the seller's forms (RLS shows built-ins, the seller's own, the store's and the buyer's preferred)
  let methods: MethodLite[] = [];
  if (role === "seller" && ["requested", "quoted", "packed"].includes(o.status)) {
    const [{ data: ms }, { data: sup }] = await Promise.all([
      supabase.from("shipping_methods").select("id, name, kind, owner_id").eq("is_active", true).order("name"),
      supabase.from("store_shipping_methods").select("method_id").eq("store_id", o.store_id),
    ]);
    const supported = new Set((sup ?? []).map((s) => s.method_id));
    methods = (ms ?? [])
      .filter((m) => m.owner_id === null || m.owner_id === me || m.id === o.preferred_method_id)
      .map((m) => ({ id: m.id, name: m.name, kind: m.kind, supported: supported.has(m.id), preferred: m.id === o.preferred_method_id }))
      .sort((a, b) => Number(!!b.preferred) - Number(!!a.preferred) || Number(!!b.supported) - Number(!!a.supported) || a.name.localeCompare(b.name));
  }
  const { data: preferred } = o.preferred_method_id ? await supabase.from("shipping_methods").select("name, kind").eq("id", o.preferred_method_id).maybeSingle() : { data: null };
  const { data: payOpts } = role === "buyer" && ["quoted", "payment_submitted"].includes(o.status) ? await supabase.rpc("order_payment_options", { p_order: id }) : { data: [] };

  // timeline
  const idx = o.status === "cancelled" || o.status === "disputed" ? FLOW.indexOf((o.prev_status as OrderStatus) ?? "paid") : FLOW.indexOf(o.status);
  const stamps: Partial<Record<OrderStatus, string | null>> = {
    requested: o.created_at, quoted: o.quoted_at, payment_submitted: proofs?.length ? proofs[proofs.length - 1].created_at : null,
    paid: o.paid_at, packed: o.packed_at, shipped: o.shipped_at, delivered: o.delivered_at, completed: o.confirmed_at,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/orders" className="text-sm font-semibold text-brand hover:underline">← {t("deal.title")}</Link>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-extrabold text-brand-dark">{t("order.title")} #{o.id.slice(0, 6).toUpperCase()}</h1>
          <Badge tone={STATUS_TONE[o.status]}>{t(`order.status.${o.status}`)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/store/${o.stores.slug}`} className="font-semibold text-brand hover:underline">{o.stores.name}</Link> ↔{" "}
          {role === "seller" ? <Link href={`/buyer/${o.buyer_id}`} className="font-semibold text-brand hover:underline">{myName}</Link> : <b>{buyer?.display_name ?? t("chat.buyer")}</b>} · {timeAgo(o.created_at)}
        </p>
        {o.conversation_id && role !== "viewer" && (
          <Link href={`/messages/${o.conversation_id}`} className={buttonClass("outline", "sm", "w-fit gap-2")}><MessageCircle size={16} aria-hidden /> {t("order.open_chat")}</Link>
        )}
      </section>

      {/* timeline */}
      <ol className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-2" aria-label={t("order.progress")}>
        {FLOW.map((s, i) => {
          const done = i < idx || (i === idx && o.status !== "cancelled" && o.status !== "disputed");
          const current = i === idx && o.status !== "cancelled" && o.status !== "completed";
          return (
            <li key={s} className={`min-w-24 flex-1 rounded-xl p-2 text-center text-[11px] leading-tight ${current ? "bg-white font-bold text-brand-dark shadow-sm" : done ? "text-success" : "text-muted-foreground"}`}>
              <span className="mb-1 flex justify-center">{done ? <Check size={14} aria-hidden /> : <span className="h-3.5" />}</span>
              {t(`order.status.${s}`)}
              {stamps[s] && <span className="mt-0.5 block font-normal text-muted-foreground">{timeAgo(stamps[s]!)}</span>}
            </li>
          );
        })}
      </ol>
      {o.status === "cancelled" && (
        <p className="rounded-2xl bg-muted p-3 text-sm"><b>{t("order.status.cancelled")}</b>{o.cancel_reason ? ` — ${o.cancel_reason}` : ""} {o.cancelled_from && ["payment_submitted", "paid", "packed"].includes(o.cancelled_from) && <span className="block text-xs text-muted-foreground">{t("order.refund_note")}</span>}</p>
      )}

      {/* items & totals */}
      <section className={card} aria-labelledby="items-h">
        <h2 id="items-h" className="font-bold text-brand-dark">{t("order.items")}</h2>
        <ul className="divide-y divide-border text-sm">
          {items_.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0 flex-1">{i.title}</span>
              <span className="text-muted-foreground">
                {i.available_qty != null && i.available_qty !== i.quantity ? <><s>{i.quantity}</s> {i.available_qty}</> : i.quantity} {i.unit} × {i.unit_price != null ? formatPeso(i.unit_price) : t("cart.price_pending")}
              </span>
              <b>{i.unit_price != null ? formatPeso((i.available_qty ?? i.quantity) * i.unit_price) : "—"}</b>
            </li>
          ))}
        </ul>
        {o.status !== "requested" && (
          <dl className="space-y-1 border-t border-border pt-2 text-sm">
            <div className="flex justify-between"><dt>{t("cart.subtotal")}</dt><dd>{formatPeso(itemsTotal)}</dd></div>
            <div className="flex justify-between"><dt>{t("order.shipping_fee")}</dt><dd>{formatPeso(o.shipping_fee)}</dd></div>
            <div className="flex justify-between text-base font-extrabold text-brand-dark"><dt>{t("order.total")}</dt><dd>{formatPeso(o.amount)}</dd></div>
          </dl>
        )}
        {o.seller_note && <p className="rounded-xl bg-brand-soft p-2 text-sm"><b>{t("order.seller_says")}:</b> {o.seller_note}</p>}
        {o.buyer_note && <p className="rounded-xl bg-muted p-2 text-sm"><b>{t("order.buyer_says")}:</b> {o.buyer_note}</p>}
        {o.quote_expires_at && o.status === "quoted" && <p className="text-xs text-muted-foreground">{expired ? t("order.quote_expired") : t("order.quote_until", { date: when(o.quote_expires_at)! })}</p>}
      </section>

      {/* delivery */}
      {delivery && role !== "viewer" && (
        <section className={card}>
          <h2 className="font-bold text-brand-dark">{t("checkout.delivery")}</h2>
          <p className="text-sm">{delivery.recipient_name} · {delivery.phone}</p>
          <p className="text-sm text-muted-foreground">{delivery.address}{delivery.landmark ? ` (${delivery.landmark})` : ""}</p>
          <p className="text-sm">
            {t("order.urgency")}: <b>{t(`order.urgency.${o.urgency}`)}</b>
            {preferred && <> · {t("order.buyer_prefers")}: <b>{preferred.name}</b> ({t(`ship.kind.${preferred.kind}`)})</>}
          </p>
        </section>
      )}

      {/* ===== role-specific panel ===== */}
      {role === "seller" && o.status === "requested" && (
        <QuoteForm orderId={id} requote={false} methods={methods}
          items={items_.map((i) => ({ id: i.id, title: i.title, unit: i.unit, quantity: i.quantity, unit_price: i.unit_price }))} />
      )}
      {role === "seller" && o.status === "quoted" && (
        <details className={card}>
          <summary className="cursor-pointer font-semibold text-brand-dark">{t("order.requote")}</summary>
          <QuoteForm orderId={id} requote methods={methods}
            items={items_.map((i) => ({ id: i.id, title: i.title, unit: i.unit, quantity: i.quantity, unit_price: i.unit_price }))} />
        </details>
      )}
      {role === "buyer" && o.status === "quoted" && (
        <PayForm orderId={id} userId={me} total={o.amount} expired={expired} options={payOpts ?? []} />
      )}
      {role === "buyer" && o.status === "requested" && <p className="rounded-2xl bg-accent-soft p-3 text-sm text-accent-strong">{t("order.waiting_quote")}</p>}
      {role === "seller" && o.status === "quoted" && <p className="rounded-2xl bg-accent-soft p-3 text-sm text-accent-strong">{t("order.waiting_payment")}</p>}

      {(proofs?.length ?? 0) > 0 && role !== "viewer" && (
        <section className={card} aria-labelledby="pay-h">
          <h2 id="pay-h" className="font-bold text-brand-dark">{t("order.payments")}</h2>
          {o.cod && <p className="text-sm font-semibold">{t("order.cod_chosen")}</p>}
          <ul className="space-y-3">
            {proofs!.map((p) => (
              <li key={p.id} className="space-y-1 rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{t(`pay.kind.${p.method}`)} · {t("order.ref")} {p.reference_no}</b>
                  <Badge tone={p.status === "confirmed" ? "success" : p.status === "rejected" ? "danger" : "accent"}>{t(`pay.status.${p.status}`)}</Badge>
                </div>
                <p>{formatPeso(p.amount)} {Math.abs(p.amount - o.amount) > 0.009 && <span className="text-danger">({t("order.amount_differs", { total: formatPeso(o.amount) })})</span>} · {when(p.created_at)}</p>
                {urls[p.proof_path] && (isPdf(p.proof_path) ? <a className="font-semibold text-brand underline" href={urls[p.proof_path]} target="_blank" rel="noopener noreferrer">{t("order.open_file")}</a> :
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={urls[p.proof_path]} target="_blank" rel="noopener noreferrer"><img src={urls[p.proof_path]} alt={t("order.proof")} loading="lazy" className="max-h-64 rounded-lg border border-border" /></a>)}
                {p.seller_note && <p className="text-muted-foreground">{t("order.seller_says")}: {p.seller_note}</p>}
              </li>
            ))}
          </ul>
          {role === "seller" && o.status === "payment_submitted" && <PaymentReview orderId={id} />}
          {role === "buyer" && o.status === "payment_submitted" && <p className="text-sm text-muted-foreground">{t("order.waiting_confirm")}</p>}
        </section>
      )}

      {role === "seller" && o.status === "paid" && (
        <PackForm orderId={id} userId={me} items={items_.filter((i) => (i.available_qty ?? 0) > 0).map((i) => ({ id: i.id, title: i.title, unit: i.unit, qty: i.available_qty ?? i.quantity }))} />
      )}
      {role === "buyer" && ["paid"].includes(o.status) && <p className="rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">{o.cod ? t("order.cod_waiting_pack") : t("order.paid_waiting_pack")}</p>}

      {(packs?.length ?? 0) > 0 && role !== "viewer" && (
        <section className={card} aria-labelledby="pack-h">
          <h2 id="pack-h" className="font-bold text-brand-dark">{t("order.packing_proof")}</h2>
          <p className="text-xs text-muted-foreground">{t("order.packed_at", { date: when(o.packed_at) ?? "" })}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {packs!.map((p) => (
              <li key={p.id}>
                {urls[p.photo_path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={urls[p.photo_path]} target="_blank" rel="noopener noreferrer"><img src={urls[p.photo_path]} alt={t("order.packing_proof")} loading="lazy" className="aspect-square w-full rounded-xl border border-border object-cover" /></a>
                )}
                <time className="block text-[11px] text-muted-foreground">{when(p.created_at)}</time>
              </li>
            ))}
          </ul>
          {packs![0].note && <p className="text-sm">{packs![0].note}</p>}
          <ul className="space-y-0.5 text-sm">{items_.filter((i) => i.packed).map((i) => <li key={i.id}>✓ {i.available_qty ?? i.quantity} {i.unit} — {i.title}</li>)}</ul>
        </section>
      )}

      {role === "seller" && o.status === "packed" && <ShipForm orderId={id} userId={me} methods={methods} />}
      {role === "buyer" && o.status === "packed" && <p className="rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">{t("order.packed_waiting_ship")}</p>}

      {ship && role !== "viewer" && (
        <section className={card} aria-labelledby="ship-h">
          <h2 id="ship-h" className="font-bold text-brand-dark">{t("order.shipment")}</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">{t("order.ship_via")}</dt><dd className="font-semibold">{ship.method_name} · {t(`ship.kind.${ship.method_kind}`)}</dd></div>
            {ship.tracking_number && <div><dt className="text-xs text-muted-foreground">{t("order.tracking_no")}</dt><dd className="font-mono font-semibold">{ship.tracking_number}</dd></div>}
            {ship.booking_link && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t("order.booking_link")}</dt><dd><a href={ship.booking_link} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-brand underline">{ship.booking_link}</a></dd></div>}
            {ship.driver_name && <div><dt className="text-xs text-muted-foreground">{t("order.driver_name")}</dt><dd>{ship.driver_name}{ship.driver_phone ? ` · ${ship.driver_phone}` : ""}</dd></div>}
            {ship.plate_no && <div><dt className="text-xs text-muted-foreground">{t("order.plate_no")}</dt><dd>{ship.plate_no}</dd></div>}
            {ship.bus_line && <div><dt className="text-xs text-muted-foreground">{t("order.bus_line")}</dt><dd>{ship.bus_line}</dd></div>}
            {(ship.bus_terminal_from || ship.bus_terminal_to) && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">{t("order.terminals")}</dt><dd>{ship.bus_terminal_from ?? "—"} → <b>{ship.bus_terminal_to ?? "—"}</b></dd></div>}
            {ship.eta && <div><dt className="text-xs text-muted-foreground">{t("order.eta")}</dt><dd>{when(ship.eta)}</dd></div>}
            <div><dt className="text-xs text-muted-foreground">{t("order.shipped_at")}</dt><dd>{when(ship.shipped_at)}</dd></div>
          </dl>
          {ship.waybill_path && urls[ship.waybill_path] && (
            isPdf(ship.waybill_path) ? <a className="font-semibold text-brand underline" href={urls[ship.waybill_path]} target="_blank" rel="noopener noreferrer">{t("order.waybill")}</a> :
            // eslint-disable-next-line @next/next/no-img-element
            <a href={urls[ship.waybill_path]} target="_blank" rel="noopener noreferrer"><img src={urls[ship.waybill_path]} alt={t("order.waybill")} loading="lazy" className="max-h-56 rounded-lg border border-border" /></a>
          )}
          {ship.notes && <p className="text-sm text-muted-foreground">{ship.notes}</p>}
        </section>
      )}

      {/* state actions */}
      {role === "seller" && o.status === "shipped" && <OrderActions orderId={id} canDeliver />}
      {role === "buyer" && (o.status === "shipped" || o.status === "delivered") && (
        <section className={card}>
          <p className="text-sm">{o.status === "delivered" ? t("order.delivered_confirm") : t("order.shipped_confirm")}</p>
          <OrderActions orderId={id} canReceive />
        </section>
      )}
      {((role === "buyer" && ["requested", "quoted"].includes(o.status)) || (role === "seller" && ["requested", "quoted", "payment_submitted", "paid", "packed"].includes(o.status))) && (
        <OrderActions orderId={id} canCancel />
      )}

      {/* completed: reviews, reorder, late disputes */}
      {o.status === "completed" && role !== "viewer" && (
        <section className={card}>
          <h2 className="font-bold text-success">✓ {t("order.completed_title")}</h2>
          {myReview ? <p className="text-sm text-success">✓ {t("review.done")}</p> : <ReviewForm orderId={id} userId={me} aboutLabel={role === "buyer" ? o.stores.name : myName} />}
          {role === "buyer" && <ReorderButton orderId={id} />}
        </section>
      )}
      {role === "buyer" && o.status === "cancelled" && <section className={card}><ReorderButton orderId={id} /></section>}

      {/* dispute */}
      {dispute && role !== "viewer" && (
        <section className="space-y-3 rounded-2xl border border-danger/40 bg-danger-soft/40 p-4" aria-labelledby="disp-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="disp-h" className="font-bold text-danger">{t("dispute.title")}</h2>
            <Badge tone={dispute.status === "open" ? "danger" : "neutral"}>{dispute.status === "open" ? t("dispute.status.open") : t("dispute.status.resolved")}</Badge>
          </div>
          <p className="text-sm"><b>{t(`dispute.reason.${dispute.reason}`)}</b> — {dispute.opened_by === me ? t("dispute.you_opened") : t("dispute.they_opened")}</p>
          <blockquote className="rounded-xl bg-white p-3 text-sm">{dispute.details}</blockquote>
          {dispute.response_body && <blockquote className="rounded-xl bg-white p-3 text-sm"><b>{t("dispute.other_side")}:</b> {dispute.response_body}</blockquote>}
          {(evidence?.length ?? 0) > 0 && (
            <ul className="flex flex-wrap gap-2">
              {evidence!.map((e, i) => urls[e.storage_path] && (
                <li key={e.id}><a href={urls[e.storage_path]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-border bg-white px-3 text-xs font-semibold text-brand-dark">{t("cases.evidence")} {i + 1} {e.uploader_id === me ? `(${t("dispute.yours")})` : ""}</a></li>
              ))}
            </ul>
          )}
          {dispute.status === "open" && dispute.respondent_id === me && !dispute.responded_at && <DisputeRespondForm orderId={id} disputeId={dispute.id} userId={me} />}
          {dispute.status === "open" && (
            <p className="text-xs text-muted-foreground">{dispute.responded_at ? t("dispute.waiting_admin") : t("dispute.due", { date: when(dispute.response_due_at)! })}</p>
          )}
          {dispute.status === "resolved" && (
            <div className="rounded-xl bg-white p-3 text-sm">
              <p className="font-bold">{t("dispute.outcome")}: {t(`dispute.outcome.${dispute.outcome}`)}</p>
              <p className="mt-1">{dispute.admin_note}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("dispute.outcome_note")}</p>
            </div>
          )}
        </section>
      )}
      {role !== "viewer" && !(dispute && dispute.status === "open") && !dispute &&
        (["paid", "packed", "shipped", "delivered"].includes(o.status) || (o.status === "completed" && !!o.confirmed_at && new Date(o.confirmed_at).getTime() > nowMs() - 14 * 86_400_000)) && (
        <DisputeOpenForm orderId={id} userId={me} role={role} />
      )}
    </div>
  );
}
