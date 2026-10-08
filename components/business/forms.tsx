"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addExpense, addIncome, addRestockReminder, adjustStock, crmSave, deleteEntry, deleteFollowUp, deleteRestockReminder, requestPlan, saveFollowUp, saveSms,
  saveSmsOptIn, saveSupplier, setLowStockThreshold, setReminderOptOut, toggleRestockReminder, type R,
} from "@/app/actions/business";
import { TIERS, tierByKey } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Runs a server action, shows a friendly message (including the "Pro" note), refreshes data. */
function useAct() {
  const { t } = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; pro?: boolean } | null>(null);
  const [pending, start] = useTransition();
  function run(fn: () => Promise<R>, okText?: string, after?: () => void) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMsg({ ok: true, text: okText ?? t("common.saved") });
        after?.();
        router.refresh();
        return;
      }
      const known: Record<string, string> = { pro: t("pro.note"), invalid: t("sell.invalid"), phone: t("auth.bad_phone"), auth: t("common.error"), failed: t("common.error") };
      setMsg({ ok: false, pro: res.pro, text: (res.error && known[res.error]) || res.error || t("common.error") });
    });
  }
  const Msg = () =>
    msg ? (
      <p role={msg.ok ? "status" : "alert"} className={cn("text-sm font-medium", msg.ok ? "text-success" : "text-danger")}>
        {msg.text} {msg.pro && <a href="/business/plan" className="underline">{t("pro.subscribe")}</a>}
      </p>
    ) : null;
  return { run, pending, Msg };
}

const box = "space-y-3 rounded-2xl border border-border bg-white p-4";

/* ───────── CRM ───────── */
export function CrmForm({ storeId, buyerId, notes, tags }: { storeId: string; buyerId: string; notes: string; tags: string[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [n, setN] = useState(notes);
  const [tg, setTg] = useState(tags.join(", "));
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); run(() => crmSave(storeId, buyerId, n, tg)); }}>
      <h2 className="font-bold text-brand-dark">{t("crm.notes_title")}</h2>
      <Field label={t("crm.notes")} hint={t("crm.notes_hint")}><Textarea value={n} onChange={(e) => setN(e.target.value)} maxLength={1000} className="min-h-24" /></Field>
      <Field label={t("crm.tags")} hint={t("crm.tags_hint")}><Input value={tg} onChange={(e) => setTg(e.target.value)} maxLength={400} placeholder="vip, reseller, gcash" /></Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("common.save")}</Button>
    </form>
  );
}

/* ───────── Suppliers ───────── */
export function SupplierForm({ storeId, notes, tags, favorite }: { storeId: string; notes: string; tags: string[]; favorite: boolean }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [n, setN] = useState(notes);
  const [tg, setTg] = useState(tags.join(", "));
  const [fav, setFav] = useState(favorite);
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => saveSupplier(storeId, n, tg, fav)); }}>
      <label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[var(--brand)]" checked={fav} onChange={(e) => setFav(e.target.checked)} /> ★ {t("supplier.favorite")}</label>
      <Input value={tg} onChange={(e) => setTg(e.target.value)} maxLength={400} placeholder={t("crm.tags_hint")} aria-label={t("crm.tags")} />
      <Textarea value={n} onChange={(e) => setN(e.target.value)} maxLength={1000} className="min-h-16" placeholder={t("supplier.notes_ph")} aria-label={t("crm.notes")} />
      <Msg />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>{t("common.save")}</Button>
    </form>
  );
}

/* ───────── Reminders ───────── */
export function RestockForm({ stores }: { stores: { id: string; name: string }[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [title, setTitle] = useState("");
  const [store, setStore] = useState("");
  const [days, setDays] = useState("30");
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); run(() => addRestockReminder({ title, storeId: store, everyDays: Number(days) || 30 }), t("rem.added"), () => setTitle("")); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("rem.title")} className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={80} placeholder={t("rem.title_ph")} /></Field>
        <Field label={t("rem.every")}>
          <Select value={days} onChange={(e) => setDays(e.target.value)}>{[7, 14, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{t("order.days", { n: d })}</option>)}</Select>
        </Field>
      </div>
      <Field label={t("rem.supplier")} hint={t("store.optional")}>
        <Select value={store} onChange={(e) => setStore(e.target.value)}><option value="">—</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("rem.add")}</Button>
    </form>
  );
}

export function RestockRow({ id, title, every, nextRun, enabled }: { id: string; title: string; every: number; nextRun: string; enabled: boolean }) {
  const { t } = useT();
  const { run, pending } = useAct();
  return (
    <li className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
      <label className="flex min-h-10 items-center"><input type="checkbox" aria-label={t("rem.enabled")} className="h-5 w-5 accent-[var(--brand)]" checked={enabled} disabled={pending} onChange={(e) => run(() => toggleRestockReminder(id, e.target.checked))} /></label>
      <span className="min-w-0 flex-1"><b>{title}</b> <span className="text-muted-foreground">· {t("rem.every_n", { n: every })} · {t("rem.next", { date: new Date(nextRun).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) })}</span></span>
      <button type="button" aria-label={t("my.delete")} disabled={pending} onClick={() => run(() => deleteRestockReminder(id))} className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft"><Trash2 size={16} aria-hidden /></button>
    </li>
  );
}

export function FollowUpForm({ storeId, customers, products, fixedBuyer }: { storeId: string; customers: { id: string; name: string }[]; products: { id: string; title: string }[]; fixedBuyer?: string }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [scope, setScope] = useState<"customer" | "product">(fixedBuyer ? "customer" : "product");
  const [buyer, setBuyer] = useState(fixedBuyer ?? "");
  const [listing, setListing] = useState("");
  const [days, setDays] = useState("30");
  const [message, setMessage] = useState("");
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveFollowUp({ storeId, buyerId: scope === "customer" ? buyer : "", listingId: scope === "product" ? listing : "", everyDays: Number(days) || 30, message }), t("rem.added"));
      }}
    >
      <h3 className="font-bold text-brand-dark">{t("rem.follow_new")}</h3>
      <p className="text-xs text-muted-foreground">{t("rem.follow_hint")}</p>
      {!fixedBuyer && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {(["product", "customer"] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)} className={cn("min-h-11 rounded-xl border px-2 text-sm font-semibold", scope === s ? "border-brand bg-brand-soft text-brand-dark" : "border-border")}>
              {t(`rem.scope.${s}`)}
            </button>
          ))}
        </div>
      )}
      {scope === "customer" && !fixedBuyer && (
        <Field label={t("rem.scope.customer")}><Select value={buyer} onChange={(e) => setBuyer(e.target.value)} required><option value="" disabled>—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      )}
      {scope === "product" && (
        <Field label={t("rem.scope.product")}><Select value={listing} onChange={(e) => setListing(e.target.value)} required><option value="" disabled>—</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
      )}
      <Field label={t("rem.follow_every")}>
        <Select value={days} onChange={(e) => setDays(e.target.value)}>{[7, 14, 21, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{t("order.days", { n: d })}</option>)}</Select>
      </Field>
      <Field label={t("rem.message")} hint={t("rem.message_hint")}><Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} className="min-h-16" placeholder={t("rem.message_ph")} /></Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("rem.follow_add")}</Button>
    </form>
  );
}

export function FollowRuleRow({ id, label, every, enabled, message }: { id: string; label: string; every: number; enabled: boolean; message: string | null }) {
  const { t } = useT();
  const { run, pending } = useAct();
  return (
    <li className="flex items-start gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        <b>{label}</b> <span className="text-muted-foreground">· {t("rem.every_n", { n: every })}</span>
        {message && <span className="block truncate text-muted-foreground">“{message}”</span>}
        {!enabled && <span className="text-xs font-semibold text-danger"> {t("rem.paused")}</span>}
      </span>
      <button type="button" disabled={pending} onClick={() => run(() => deleteFollowUp(id))} aria-label={t("my.delete")} className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft"><Trash2 size={16} aria-hidden /></button>
    </li>
  );
}

export function OptOutToggle({ storeId, storeName, optedOut }: { storeId: string; storeName: string; optedOut: boolean }) {
  const { t } = useT();
  const { run, pending } = useAct();
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate font-semibold">{storeName}</span>
      <Button size="sm" variant={optedOut ? "primary" : "outline"} disabled={pending} onClick={() => run(() => setReminderOptOut(storeId, !optedOut))}>
        {optedOut ? t("rem.resume") : t("rem.stop")}
      </Button>
    </li>
  );
}

export function SmsOptInForm({ accepts, phone }: { accepts: boolean; phone: string }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [on, setOn] = useState(accepts);
  const [ph, setPh] = useState(phone);
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); run(() => saveSmsOptIn(on, ph)); }}>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--brand)]" checked={on} onChange={(e) => setOn(e.target.checked)} /><span><b>{t("rem.sms_optin")}</b><span className="block text-muted-foreground">{t("rem.sms_optin_hint")}</span></span></label>
      <Field label={t("auth.phone")}><Input type="tel" value={ph} onChange={(e) => setPh(e.target.value)} placeholder="09XX XXX XXXX" /></Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("common.save")}</Button>
    </form>
  );
}

/* ───────── SMS setup (Pro) ───────── */
export function SmsSetupForm({ phone, enabled }: { phone: string; enabled: boolean }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [ph, setPh] = useState(phone);
  const [on, setOn] = useState(enabled);
  const [agree, setAgree] = useState(enabled);
  return (
    <form className={box} onSubmit={(e) => { e.preventDefault(); run(() => saveSms(ph, on && agree)); }}>
      <Field label={t("sms.sender_phone")} hint={t("sms.sender_phone_hint")}><Input type="tel" value={ph} onChange={(e) => setPh(e.target.value)} required placeholder="09XX XXX XXXX" /></Field>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--brand)]" checked={on} onChange={(e) => setOn(e.target.checked)} /><span><b>{t("sms.enable")}</b><span className="block text-muted-foreground">{t("sms.enable_hint")}</span></span></label>
      {on && (
        <label className="flex items-start gap-3 rounded-xl bg-muted p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--brand)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{t("sms.terms")}</span></label>
      )}
      <Msg />
      <Button type="submit" disabled={pending || (on && !agree)}>{t("common.save")}</Button>
    </form>
  );
}

/* ───────── Plan ───────── */
export function RequestPlanForm({ currentRank, requested }: { currentRank: number; requested: { plan: string; billing: string } | null }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const options = TIERS.filter((x) => x.rank > 0 && x.rank !== currentRank);
  const [tier, setTier] = useState<string>(options.find((x) => x.rank > currentRank)?.key ?? options[0]?.key ?? "starter");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [note, setNote] = useState("");
  const chosen = TIERS.find((x) => x.key === tier) ?? TIERS[1];
  if (requested) return <p className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">✓ {t("plan.requested_for", { tier: tierByKey(requested.plan).name, billing: t(`plan.billing.${requested.billing}`) })}</p>;
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => requestPlan(tier, billing, note), t("plan.requested")); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("plan.pick_tier")}>
          <select className="h-12 w-full rounded-xl border border-border bg-white px-3" value={tier} onChange={(e) => setTier(e.target.value)}>
            {options.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={t("plan.pick_billing")}>
          <select className="h-12 w-full rounded-xl border border-border bg-white px-3" value={billing} onChange={(e) => setBilling(e.target.value as "monthly" | "yearly")}>
            <option value="monthly">{t("plan.per_month", { n: "₱" + chosen.monthly })}</option>
            <option value="yearly">{t("plan.per_year", { n: "₱" + chosen.yearly })}</option>
          </select>
        </Field>
      </div>
      <Field label={t("plan.request_note")} hint={t("store.optional")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("plan.request_note_ph")} /></Field>
      <Msg />
      <Button type="submit" variant="accent" size="lg" disabled={pending}>{t("plan.request", { tier: chosen.name })}</Button>
    </form>
  );
}

/* ───────── Finance ───────── */
export function EntryForm({ kind, categories }: { kind: "income" | "expense"; categories: string[] }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "");
  const [vendor, setVendor] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault();
        const input = { date, amount: Number(amount), category, note, vendor };
        run(() => (kind === "income" ? addIncome(input) : addExpense(input)), t("fin.added"), () => { setAmount(""); setNote(""); setVendor(""); });
      }}
    >
      <h3 className="font-bold text-brand-dark">{kind === "income" ? t("fin.add_income") : t("fin.add_expense")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("fin.date")}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label={t("fin.amount")}><Input type="number" min={0.01} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="₱" /></Field>
        <Field label={t("fin.category")}>
          <Input list={`cats-${kind}`} value={category} onChange={(e) => setCategory(e.target.value)} required minLength={2} maxLength={40} />
          <datalist id={`cats-${kind}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      {kind === "expense" && <Field label={t("fin.vendor")} hint={t("store.optional")}><Input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={80} /></Field>}
      <Field label={t("fin.note")} hint={t("store.optional")}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
      <Msg />
      <Button type="submit" disabled={pending}>{t("rem.add")}</Button>
    </form>
  );
}

export function EntryDelete({ kind, id }: { kind: "income" | "expense"; id: string }) {
  const { t } = useT();
  const { run, pending } = useAct();
  return <button type="button" aria-label={t("my.delete")} disabled={pending} onClick={() => run(() => deleteEntry(kind, id))} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger-soft"><Trash2 size={15} aria-hidden /></button>;
}

/* ───────── Inventory ───────── */
export function StockRow({ id, title, qty, threshold, tracked }: { id: string; title: string; qty: number | null; threshold: number | null; tracked: boolean }) {
  const { t } = useT();
  const { run, pending, Msg } = useAct();
  const [q, setQ] = useState(qty === null ? "" : String(qty));
  const [th, setTh] = useState(threshold === null ? "" : String(threshold));
  const low = qty !== null && qty <= (threshold ?? 5);
  return (
    <li className={cn("space-y-2 rounded-2xl border bg-white p-3", low ? "border-danger/50" : "border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        {low && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">{qty === 0 ? t("inv.out") : t("inv.low")}</span>}
        {!tracked && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t("inv.untracked")}</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">{t("inv.on_hand")}
          <Input type="number" min={0} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-28 text-base" />
        </label>
        <Button size="sm" disabled={pending || q === ""} onClick={() => run(() => adjustStock(id, Number(q)), t("inv.saved"))}>{t("inv.set_count")}</Button>
        <label className="ml-auto space-y-1 text-xs font-semibold text-muted-foreground">{t("inv.alert_at")}
          <Input type="number" min={0} inputMode="numeric" value={th} placeholder="5" onChange={(e) => setTh(e.target.value)} onBlur={() => run(() => setLowStockThreshold(id, th === "" ? null : Number(th)))} className="h-10 w-24 text-base" />
        </label>
      </div>
      <Msg />
    </li>
  );
}
