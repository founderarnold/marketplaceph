"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCustomMethod, addPaymentMethod, deleteCustomMethod, deletePaymentMethod, setListingShipping, setStoreShipping } from "@/app/actions/shipping";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { SHIPPING_KINDS, type ShippingKind } from "@/lib/shipping";

export type Method = { id: string; name: string; kind: ShippingKind; mine: boolean; notes?: string | null };

function useSave() {
  const { t } = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText?: string) =>
    start(async () => {
      const res = await fn();
      const errs: Record<string, string> = { duplicate: t("shipset.err_duplicate"), limit: t("shipset.err_limit"), link: t("order.err_link"), no_store: t("my.no_store") };
      setMsg(res.ok ? { ok: true, text: okText ?? t("common.saved") } : { ok: false, text: (res.error && errs[res.error]) || t("common.error") });
      if (res.ok) router.refresh();
    });
  const Msg = () => (msg ? <p role="status" className={`text-sm font-medium ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p> : null);
  return { run, pending, Msg };
}

/** Add a courier / trucker / bus line of your own (buyers and sellers). */
export function CustomMethodForm() {
  const { t } = useT();
  const { run, pending, Msg } = useSave();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ShippingKind>("courier");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  return (
    <form
      className="space-y-3 rounded-xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addCustomMethod({ name, kind, notes, link }), t("shipset.added"));
        setName(""); setNotes(""); setLink("");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("shipset.name")}><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} placeholder={t("shipset.name_ph")} /></Field>
        <Field label={t("shipset.kind")}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as ShippingKind)}>
            {SHIPPING_KINDS.map((k) => <option key={k} value={k}>{t(`ship.kind.${k}`)}</option>)}
          </Select>
        </Field>
      </div>
      <Field label={t("shipset.notes")} hint={t("store.optional")}><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder={t("shipset.notes_ph")} /></Field>
      <Field label={t("shipset.link")} hint={t("store.optional")}><Input type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} placeholder="https://" /></Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("shipset.add")}</Button>
    </form>
  );
}

export function MyMethodList({ methods }: { methods: Method[] }) {
  const { t } = useT();
  const { run, pending } = useSave();
  if (!methods.length) return <p className="text-sm text-muted-foreground">{t("shipset.none_custom")}</p>;
  return (
    <ul className="space-y-1.5">
      {methods.map((m) => (
        <li key={m.id} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <span className="min-w-0 flex-1"><b>{m.name}</b> <span className="text-muted-foreground">· {t(`ship.kind.${m.kind}`)}{m.notes ? ` · ${m.notes}` : ""}</span></span>
          <button type="button" aria-label={t("my.delete")} disabled={pending} onClick={() => run(() => deleteCustomMethod(m.id), t("shipset.removed"))} className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft">
            <Trash2 size={16} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Checklist({ methods, selected, onToggle }: { methods: Method[]; selected: string[]; onToggle: (id: string) => void }) {
  const { t } = useT();
  const groups = SHIPPING_KINDS.map((k) => ({ kind: k, items: methods.filter((m) => m.kind === k) })).filter((g) => g.items.length);
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <fieldset key={g.kind}>
          <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t(`ship.kind.${g.kind}`)}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {g.items.map((m) => (
              <label key={m.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {m.mine && <span className="rounded-full bg-accent-soft px-2 text-[10px] font-bold text-accent-strong">{t("shipset.mine")}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function StoreShippingPicker({ methods, initial }: { methods: Method[]; initial: string[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useSave();
  const [sel, setSel] = useState(initial);
  return (
    <div className="space-y-3">
      <Checklist methods={methods} selected={sel} onToggle={(id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])} />
      <Msg />
      <Button disabled={pending} onClick={() => run(() => setStoreShipping(sel))}>{t("common.save")}</Button>
    </div>
  );
}

export function ListingShippingPicker({ listingId, title, methods, initial }: { listingId: string; title: string; methods: Method[]; initial: string[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useSave();
  const [sel, setSel] = useState(initial);
  return (
    <details className="rounded-xl border border-border bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">— {initial.length ? t("shipset.custom_n", { n: initial.length }) : t("shipset.uses_store")}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">{t("shipset.listing_hint")}</p>
        <Checklist methods={methods} selected={sel} onToggle={(id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])} />
        <Msg />
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => setListingShipping(listingId, sel))}>{t("common.save")}</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setSel([]); run(() => setListingShipping(listingId, [])); }}>{t("shipset.reset")}</Button>
        </div>
      </div>
    </details>
  );
}

export type PayRow = { id: string; kind: string; account_name: string | null; account_number: string | null; bank_name: string | null; instructions: string | null };

export function PaymentMethods({ rows }: { rows: PayRow[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useSave();
  const [kind, setKind] = useState("gcash");
  const [f, setF] = useState({ accountName: "", accountNumber: "", bankName: "", instructions: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const isCod = kind === "cod";
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("shipset.pay_note")}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
            <span className="min-w-0 flex-1"><b>{t(`pay.kind.${r.kind}`)}</b>{r.kind !== "cod" && <> · {r.account_name} · {r.account_number}{r.bank_name ? ` · ${r.bank_name}` : ""}</>}</span>
            <button type="button" aria-label={t("my.delete")} disabled={pending} onClick={() => run(() => deletePaymentMethod(r.id), t("shipset.removed"))} className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft"><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
        {!rows.length && <li className="text-sm text-muted-foreground">{t("shipset.no_pay")}</li>}
      </ul>
      <form className="space-y-3 rounded-xl bg-muted p-3" onSubmit={(e) => { e.preventDefault(); run(() => addPaymentMethod({ kind, ...f }), t("shipset.added")); setF({ accountName: "", accountNumber: "", bankName: "", instructions: "" }); }}>
        <Field label={t("shipset.pay_kind")}>
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {["gcash", "maya", "bank", "cod", "other"].map((k) => <option key={k} value={k}>{t(`pay.kind.${k}`)}</option>)}
          </Select>
        </Field>
        {!isCod && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("shipset.acct_name")}><Input value={f.accountName} onChange={set("accountName")} required maxLength={80} /></Field>
            <Field label={t("shipset.acct_no")}><Input value={f.accountNumber} onChange={set("accountNumber")} required maxLength={40} inputMode="numeric" /></Field>
            {kind === "bank" && <Field label={t("shipset.bank")}><Input value={f.bankName} onChange={set("bankName")} maxLength={60} /></Field>}
          </div>
        )}
        <Field label={t("shipset.instructions")} hint={t("store.optional")}><Input value={f.instructions} onChange={set("instructions")} maxLength={300} /></Field>
        <Msg />
        <Button type="submit" disabled={pending}>{t("shipset.add")}</Button>
      </form>
    </div>
  );
}
