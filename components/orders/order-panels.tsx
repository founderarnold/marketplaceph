"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelOrder, confirmReceived, markDelivered, openDispute, quoteOrder, reorder, respondToDispute, reviewPayment, shipOrder, submitPacking, submitPayment,
} from "@/app/actions/orders";
import { PrivateFileInput, type UploadedFile } from "@/components/trust/private-files";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { DISPUTE_REASONS } from "@/lib/orders";
import type { ShippingKind } from "@/lib/shipping";
import { cn } from "@/lib/utils";

type Res = { ok: boolean; error?: string };

/** Runs an order action, shows friendly errors, refreshes the page on success. */
function useAct() {
  const { t } = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(fn: () => Promise<Res>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        const known: Record<string, string> = { invalid: t("sell.invalid"), photos: t("order.err_photos"), link: t("order.err_link"), eta: t("order.err_eta"), auth: t("common.error"), failed: t("common.error") };
        return setError(res.error ? (known[res.error] ?? res.error) : t("common.error"));
      }
      after?.();
      router.refresh();
    });
  }
  const Error_ = () => (error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-danger">{error}</p> : null);
  return { run, pending, Error_ };
}

const box = "space-y-3 rounded-2xl border border-border bg-white p-4";

/* ───────── Seller: quote ───────── */
export type QuoteItem = { id: string; title: string; unit: string; quantity: number; unit_price: number | null };
export type MethodLite = { id: string; name: string; kind: ShippingKind; supported?: boolean; preferred?: boolean };

export function QuoteForm({ orderId, items, methods, requote }: { orderId: string; items: QuoteItem[]; methods: MethodLite[]; requote: boolean }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [rows, setRows] = useState(items.map((i) => ({ id: i.id, price: i.unit_price?.toString() ?? "", avail: String(i.quantity) })));
  const [fee, setFee] = useState("0");
  const [method, setMethod] = useState(methods.find((m) => m.preferred)?.id ?? "");
  const [days, setDays] = useState("3");
  const [note, setNote] = useState("");
  const total = rows.reduce((s, r) => s + (Number(r.price) || 0) * (Number(r.avail) || 0), 0) + (Number(fee) || 0);

  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          quoteOrder({
            orderId,
            items: rows.map((r) => ({ id: r.id, unit_price: r.price === "" ? null : Number(r.price), available_qty: Number(r.avail) || 0 })),
            shippingFee: Number(fee) || 0,
            methodId: method || null,
            note,
            validDays: Number(days) || 3,
          }),
        );
      }}
    >
      <h2 className="font-bold text-brand-dark">{requote ? t("order.requote") : t("order.quote_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("order.quote_hint")}</p>
      {items.map((it, i) => (
        <div key={it.id} className="grid grid-cols-[1fr_6.5rem_6rem] items-end gap-2 rounded-xl bg-muted p-2">
          <p className="col-span-3 text-sm font-semibold">{it.title} <span className="font-normal text-muted-foreground">({t("order.requested_qty", { n: it.quantity, unit: it.unit })})</span></p>
          <span />
          <Field label={t("order.unit_price")}>
            <Input type="number" min={0} step="0.01" inputMode="decimal" required value={rows[i].price} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))} />
          </Field>
          <Field label={t("order.available")}>
            <Input type="number" min={0} max={it.quantity} inputMode="numeric" required value={rows[i].avail} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, avail: e.target.value } : r)))} />
          </Field>
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("order.shipping_fee")} hint={t("order.shipping_fee_hint")}>
          <Input type="number" min={0} step="0.01" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field label={t("order.valid_days")}>
          <Select value={days} onChange={(e) => setDays(e.target.value)}>
            {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{t("order.days", { n: d })}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t("order.ship_via")} hint={t("order.ship_via_hint")}>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">{t("order.decide_later")}</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {t(`ship.kind.${m.kind}`)}{m.preferred ? ` — ${t("order.buyer_prefers")}` : ""}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("order.note_to_buyer")} hint={t("store.optional")}><Textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="min-h-16" /></Field>
      <p className="text-lg font-extrabold text-brand-dark">{t("order.total")}: ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
      <Error_ />
      <Button type="submit" disabled={pending}>{t("order.send_quote")}</Button>
    </form>
  );
}

/* ───────── Buyer: pay ───────── */
export type PayOption = { id: string; kind: string; account_name: string | null; account_number: string | null; bank_name: string | null; instructions: string | null };

export function PayForm({ orderId, userId, options, total, expired }: { orderId: string; userId: string; options: PayOption[]; total: number; expired: boolean }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const online = options.filter((o) => o.kind !== "cod");
  const cod = options.find((o) => o.kind === "cod");
  const [method, setMethod] = useState(online[0]?.kind ?? "");
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState(String(total));
  const [proof, setProof] = useState<UploadedFile[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const chosen = online.find((o) => o.kind === method);

  if (expired) return <p className="rounded-2xl bg-danger-soft p-4 text-sm font-semibold text-danger">{t("order.quote_expired")}</p>;
  return (
    <section className={box}>
      <h2 className="font-bold text-brand-dark">{t("order.pay_title")}</h2>
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("order.pay_direct")}</p>
      {online.length > 0 && (
        <>
          <ul className="space-y-2">
            {online.map((o) => (
              <li key={o.id} className={cn("rounded-xl border p-3 text-sm", method === o.kind ? "border-brand bg-brand-soft" : "border-border")}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="paym" checked={method === o.kind} onChange={() => setMethod(o.kind)} className="mt-1 h-5 w-5 accent-[var(--brand)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{t(`pay.kind.${o.kind}`)}{o.bank_name ? ` · ${o.bank_name}` : ""}</span>
                    <span className="block">{o.account_name}</span>
                    <span className="inline-flex items-center gap-2 font-mono text-base">
                      {o.account_number}
                      <button type="button" aria-label={t("order.copy")} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white" onClick={async () => { await navigator.clipboard?.writeText(o.account_number ?? ""); setCopied(o.id); setTimeout(() => setCopied(null), 1500); }}>
                        <Copy size={14} aria-hidden />
                      </button>
                      {copied === o.id && <span className="text-xs text-success">{t("share.copied")}</span>}
                    </span>
                    {o.instructions && <span className="mt-1 block text-xs text-muted-foreground">{o.instructions}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("order.pay_check_name")}</p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => submitPayment({ orderId, method: method as "gcash", reference: ref, amount: Number(amount) || 0, proofPath: proof[0]?.path ?? null }));
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("order.reference")} hint={t("order.reference_hint")}><Input value={ref} onChange={(e) => setRef(e.target.value)} required minLength={4} maxLength={60} /></Field>
              <Field label={t("order.amount_paid")}><Input type="number" min={0} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
            </div>
            <Field label={t("order.proof")} hint={chosen ? t("order.proof_hint") : undefined}>
              <PrivateFileInput userId={userId} bucket="order-files" value={proof} onChange={setProof} label={t("order.upload_proof")} />
            </Field>
            <Error_ />
            <Button type="submit" variant="accent" disabled={pending || proof.length === 0}>{t("order.submit_payment")}</Button>
          </form>
        </>
      )}
      {cod && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold">{t("order.cod_title")}</p>
          <p className="text-xs text-muted-foreground">{cod.instructions ?? t("order.cod_hint")}</p>
          <Button variant="outline" disabled={pending} onClick={() => run(() => submitPayment({ orderId, method: "cod" }))}>{t("order.choose_cod")}</Button>
        </div>
      )}
      {online.length === 0 && !cod && <p className="text-sm text-danger">{t("order.no_pay_methods")}</p>}
      {online.length === 0 && cod && <Error_ />}
    </section>
  );
}

/* ───────── Seller: confirm / reject payment ───────── */
export function PaymentReview({ orderId }: { orderId: string }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-xl bg-muted p-3">
      <p className="text-sm">{t("order.review_hint")}</p>
      <Field label={t("order.reject_note")} hint={t("store.optional")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      <Error_ />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run(() => reviewPayment(orderId, true, note))}>{t("order.confirm_payment")}</Button>
        <Button variant="outline" disabled={pending} onClick={() => run(() => reviewPayment(orderId, false, note))}>{t("order.reject_payment")}</Button>
      </div>
    </div>
  );
}

/* ───────── Seller: packing list + photos ───────── */
export function PackForm({ orderId, userId, items }: { orderId: string; userId: string; items: { id: string; title: string; unit: string; qty: number }[] }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [checked, setChecked] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [note, setNote] = useState("");
  const all = checked.length === items.length;
  return (
    <section className={box}>
      <h2 className="font-bold text-brand-dark">{t("order.pack_title")}</h2>
      <p className="text-sm text-muted-foreground">{t("order.pack_hint")}</p>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={checked.includes(i.id)} onChange={(e) => setChecked(e.target.checked ? [...checked, i.id] : checked.filter((x) => x !== i.id))} />
              <span className="flex-1">{i.title}</span>
              <b>{i.qty} {i.unit}</b>
            </label>
          </li>
        ))}
      </ul>
      <Field label={t("order.pack_photos")} hint={t("order.pack_photos_hint")}>
        <PrivateFileInput userId={userId} bucket="order-files" value={photos} onChange={setPhotos} max={6} label={t("order.add_photo")} />
      </Field>
      <Field label={t("order.pack_note")} hint={t("store.optional")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></Field>
      <Error_ />
      <Button disabled={pending || !all || photos.length === 0} onClick={() => run(() => submitPacking(orderId, checked, photos.map((p) => p.path), note))}>{t("order.mark_packed")}</Button>
    </section>
  );
}

/* ───────── Seller: ship ───────── */
export function ShipForm({ orderId, userId, methods }: { orderId: string; userId: string; methods: MethodLite[] }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [method, setMethod] = useState(methods.find((m) => m.preferred)?.id ?? methods.find((m) => m.supported)?.id ?? "");
  const [f, setF] = useState<Record<string, string>>({});
  const [waybill, setWaybill] = useState<UploadedFile[]>([]);
  const kind: ShippingKind | null = methods.find((m) => m.id === method)?.kind ?? null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const bus = kind === "bus";
  const vehicle = kind === "on_demand" || kind === "trucking" || kind === "van_jeep" || kind === "bus";
  const tracking = kind === "courier" || kind === "other" || kind === null;

  return (
    <section className={box}>
      <h2 className="font-bold text-brand-dark">{t("order.ship_title")}</h2>
      <Field label={t("order.ship_via")}>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">{t("order.other_method")}</option>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name} · {t(`ship.kind.${m.kind}`)}{m.preferred ? ` — ${t("order.buyer_prefers")}` : ""}</option>)}
        </Select>
      </Field>
      {!method && <Field label={t("order.method_name")}><Input value={f.method_name ?? ""} onChange={set("method_name")} maxLength={60} required /></Field>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(tracking || kind === "bus") && <Field label={t("order.tracking_no")}><Input value={f.tracking_number ?? ""} onChange={set("tracking_number")} maxLength={80} /></Field>}
        {(kind === "on_demand" || tracking) && <Field label={t("order.booking_link")} hint={t("order.booking_link_hint")}><Input type="url" value={f.booking_link ?? ""} onChange={set("booking_link")} maxLength={300} placeholder="https://" /></Field>}
        {vehicle && <Field label={t("order.driver_name")}><Input value={f.driver_name ?? ""} onChange={set("driver_name")} maxLength={80} /></Field>}
        {vehicle && <Field label={t("order.driver_phone")}><Input type="tel" value={f.driver_phone ?? ""} onChange={set("driver_phone")} maxLength={20} /></Field>}
        {vehicle && <Field label={t("order.plate_no")}><Input value={f.plate_no ?? ""} onChange={set("plate_no")} maxLength={20} /></Field>}
        {bus && <Field label={t("order.bus_line")}><Input value={f.bus_line ?? ""} onChange={set("bus_line")} maxLength={80} /></Field>}
        {bus && <Field label={t("order.terminal_from")}><Input value={f.bus_terminal_from ?? ""} onChange={set("bus_terminal_from")} maxLength={120} /></Field>}
        {bus && <Field label={t("order.terminal_to")}><Input value={f.bus_terminal_to ?? ""} onChange={set("bus_terminal_to")} maxLength={120} /></Field>}
        <Field label={t("order.eta")} hint={t("store.optional")}><Input type="datetime-local" value={f.eta ?? ""} onChange={set("eta")} /></Field>
      </div>
      {(bus || kind === "courier" || kind === "trucking") && (
        <Field label={t("order.waybill")} hint={t("order.waybill_hint")}>
          <PrivateFileInput userId={userId} bucket="order-files" value={waybill} onChange={setWaybill} label={t("order.upload_waybill")} />
        </Field>
      )}
      <Field label={t("order.ship_notes")} hint={t("store.optional")}><Textarea value={f.notes ?? ""} onChange={set("notes")} maxLength={300} className="min-h-16" /></Field>
      <Error_ />
      <Button disabled={pending} onClick={() => run(() => shipOrder({ orderId, methodId: method || null, details: { ...f, waybill_path: waybill[0]?.path } }))}>{t("order.mark_shipped")}</Button>
    </section>
  );
}

/* ───────── Simple actions ───────── */
export function OrderActions({ orderId, canDeliver, canReceive, canCancel }: { orderId: string; canDeliver?: boolean; canReceive?: boolean; canCancel?: boolean }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [reason, setReason] = useState("");
  const [askCancel, setAskCancel] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canDeliver && <Button variant="outline" disabled={pending} onClick={() => run(() => markDelivered(orderId))}>{t("order.mark_delivered")}</Button>}
        {canReceive && <Button disabled={pending} onClick={() => run(() => confirmReceived(orderId))}>{t("order.confirm_received")}</Button>}
        {canCancel && !askCancel && <Button variant="ghost" onClick={() => setAskCancel(true)}>{t("deal.cancel")}</Button>}
      </div>
      {askCancel && (
        <div className="space-y-2 rounded-xl bg-muted p-3">
          <Field label={t("order.cancel_reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
          <p className="text-xs text-muted-foreground">{t("order.cancel_refund_note")}</p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" disabled={pending} onClick={() => run(() => cancelOrder(orderId, reason))}>{t("order.confirm_cancel")}</Button>
            <Button variant="ghost" size="sm" onClick={() => setAskCancel(false)}>{t("common.cancel")}</Button>
          </div>
        </div>
      )}
      {!askCancel && <Error_ />}
    </div>
  );
}

export function ReorderButton({ orderId }: { orderId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [notes, setNotes] = useState<string[] | null>(null);
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  const label = (n: string) => {
    const [kind, rest] = [n.slice(0, n.indexOf(":")), n.slice(n.indexOf(":") + 1)];
    if (kind === "moq") { const [title, moq] = rest.split("|"); return t("reorder.moq", { title, n: moq }); }
    return t(kind === "out" ? "reorder.out" : "reorder.gone", { title: rest });
  };
  return (
    <div className="space-y-2">
      <Button variant="accent" disabled={pending} onClick={() => start(async () => {
        setErr(false);
        const res = await reorder(orderId);
        setNotes(res.notes ?? []);
        if (!res.ok) return setErr(true);
        router.push("/cart");
      })}>{t("order.reorder")}</Button>
      {err && <p role="alert" className="text-sm font-medium text-danger">{t("reorder.nothing")}</p>}
      {notes && notes.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground">{notes.map((n) => <li key={n}>{label(n)}</li>)}</ul>}
      <p className="text-xs text-muted-foreground">{t("order.reorder_hint")}</p>
    </div>
  );
}

/* ───────── Disputes ───────── */
export function DisputeOpenForm({ orderId, userId, role }: { orderId: string; userId: string; role: "buyer" | "seller" }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(role === "buyer" ? "not_received" : "payment_not_received");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t("dispute.open")}</Button>;
  return (
    <form
      className={box}
      onSubmit={(e) => { e.preventDefault(); run(() => openDispute(orderId, reason, details, files.map((f) => f.path))); }}
    >
      <h2 className="font-bold text-danger">{t("dispute.open")}</h2>
      <p className="text-xs text-muted-foreground">{t("dispute.process")}</p>
      <Field label={t("dispute.reason")}>
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {DISPUTE_REASONS.map((r) => <option key={r} value={r}>{t(`dispute.reason.${r}`)}</option>)}
        </Select>
      </Field>
      <Field label={t("dispute.details")} hint={t("dispute.details_hint")}><Textarea value={details} onChange={(e) => setDetails(e.target.value)} required minLength={10} maxLength={2000} /></Field>
      <Field label={t("report.evidence")} hint={t("dispute.evidence_hint")}>
        <PrivateFileInput userId={userId} bucket="order-files" value={files} onChange={setFiles} max={6} label={t("report.add_evidence")} />
      </Field>
      <Error_ />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending}>{t("dispute.submit")}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </form>
  );
}

export function DisputeRespondForm({ orderId, disputeId, userId }: { orderId: string; disputeId: string; userId: string }) {
  const { t } = useT();
  const { run, pending, Error_ } = useAct();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  return (
    <form className="space-y-3 rounded-xl bg-muted p-3" onSubmit={(e) => { e.preventDefault(); run(() => respondToDispute(orderId, disputeId, body, files.map((f) => f.path))); }}>
      <p className="text-sm font-semibold text-brand-dark">{t("dispute.respond_title")}</p>
      <Field label={t("dispute.your_side")}><Textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={5} maxLength={2000} /></Field>
      <Field label={t("report.evidence")} hint={t("dispute.evidence_hint")}>
        <PrivateFileInput userId={userId} bucket="order-files" value={files} onChange={setFiles} max={6} label={t("report.add_evidence")} />
      </Field>
      <Error_ />
      <Button type="submit" disabled={pending}>{t("cases.send_response")}</Button>
      <p className="text-xs text-muted-foreground">{t("cases.respond_once")}</p>
    </form>
  );
}
