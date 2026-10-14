"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRequest, deleteRequest, respondToOffer, sendOffer, setRequestStatus, withdrawOffer, type RqResult } from "@/app/actions/requests";
import { CategoryOptions } from "@/components/listing/category-options";
import { LocationSelect } from "@/components/listing/location-select";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Category, Locations } from "@/lib/data";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

function useRun() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<RqResult>, okText?: string, after?: () => void) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) {
        const map: Record<string, string> = { invalid: t("rq.invalid"), no_store: t("rq.no_store"), already_offered: t("rq.already_offered"), auth: t("rq.sign_in") };
        return setMsg({ ok: false, text: (res.error && map[res.error]) || (res.error && res.error !== "failed" ? res.error : t("common.error")) });
      }
      if (okText) setMsg({ ok: true, text: okText });
      after?.();
      router.refresh();
    });
  const note = msg && <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl p-3 text-sm font-medium", msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{msg.text}</p>;
  return { pending, run, note };
}

/** "Post what you need": what, how many, budget, where and when. Uses onSubmit so a failed post keeps what was typed. */
export function RequestForm({ categories, locations }: { categories: Category[]; locations: Locations }) {
  const { t, locale } = useT();
  const { pending, run, note } = useRun();
  const [kind, setKind] = useState<"product" | "service">("product");
  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-white p-5 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("kind", kind);
        run(() => createRequest(fd));
      }}
    >
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">{t("rq.kind")}</legend>
        {(["product", "service"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("min-h-12 rounded-xl border font-semibold", kind === k ? "border-brand bg-brand-soft text-brand-dark" : "border-border hover:bg-muted")}>
            {t(`rq.kind.${k}`)}
          </button>
        ))}
      </fieldset>
      <Field label={t("rq.title_label")} hint={t("rq.title_hint")}>
        <Input name="title" required minLength={5} maxLength={120} placeholder={t(kind === "product" ? "rq.title_ph" : "rq.title_ph_service")} />
      </Field>
      <Field label={t("sell.category")} hint={t("store.optional")}>
        <Select name="category_id" defaultValue="">
          <option value="">—</option>
          <CategoryOptions categories={categories} locale={locale} valueOf="id" majorLabel={(n) => t("cat.general_in", { name: n })} />
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("rq.quantity")} hint={t("store.optional")}><Input name="quantity" type="number" inputMode="decimal" min={0} step="any" placeholder="200" /></Field>
        <Field label={t("sell.unit")} hint={t("store.optional")}><Input name="unit" maxLength={20} placeholder={t(kind === "product" ? "rq.unit_ph" : "rq.unit_ph_service")} /></Field>
        <Field label={t("rq.budget_min")} hint={t("store.optional")}><Input name="budget_min" type="number" inputMode="decimal" min={0} placeholder="₱" /></Field>
        <Field label={t("rq.budget_max")} hint={t("store.optional")}><Input name="budget_max" type="number" inputMode="decimal" min={0} placeholder="₱" /></Field>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">{t("rq.where")}</p>
        <LocationSelect locations={locations} names={{ region: "region_code", province: "province_code", city: "city_code" }} />
      </div>
      <Field label={t("rq.needed_by")} hint={t("store.optional")}><Input name="needed_by" type="date" /></Field>
      <Field label={t("rq.details")} hint={t("rq.details_hint")}>
        <Textarea name="details" maxLength={2000} rows={4} placeholder={t("rq.details_ph")} />
      </Field>
      {note}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>{t("rq.post")}</Button>
      <p className="text-center text-xs text-muted-foreground">{t("rq.post_note")}</p>
    </form>
  );
}

export function OfferForm({ requestId, listings, defaultQty }: { requestId: string; listings: { id: string; title: string }[]; defaultQty: number | null }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("request_id", requestId);
        run(() => sendOffer(fd), t("rq.offer_sent"), () => setKey((k) => k + 1));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("rq.unit_price")}><Input name="unit_price" type="number" inputMode="decimal" min={0} step="0.01" placeholder="₱" /></Field>
        <Field label={t("rq.can_supply")}><Input name="quantity" type="number" inputMode="decimal" min={0} step="any" defaultValue={defaultQty ?? undefined} /></Field>
        <Field label={t("rq.delivery_days")}><Input name="delivery_days" type="number" inputMode="numeric" min={0} max={365} placeholder="3" /></Field>
      </div>
      {listings.length > 0 && (
        <Field label={t("rq.link_listing")} hint={t("store.optional")}>
          <Select name="listing_id" defaultValue="">
            <option value="">—</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </Select>
        </Field>
      )}
      <Field label={t("rq.offer_message")}>
        <Textarea name="message" required minLength={5} maxLength={1000} rows={3} placeholder={t("rq.offer_message_ph")} />
      </Field>
      {note}
      <Button type="submit" disabled={pending}>{t("rq.send_offer")}</Button>
      <p className="text-xs text-muted-foreground">{t("rq.offer_private")}</p>
    </form>
  );
}

export function OfferDecision({ offerId, requestId }: { offerId: string; requestId: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => run(() => respondToOffer(offerId, requestId, true))}>{t("rq.accept")}</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => confirm(t("rq.confirm_decline")) && run(() => respondToOffer(offerId, requestId, false))}>{t("rq.decline")}</Button>
      </div>
      {note}
    </div>
  );
}

export function WithdrawOfferButton({ offerId, requestId }: { offerId: string; requestId: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(t("rq.confirm_withdraw")) && run(() => withdrawOffer(offerId, requestId))}>{t("rq.withdraw")}</Button>
      {note}
    </div>
  );
}

export function RequestOwnerActions({ id, status }: { id: string; status: string }) {
  const { t } = useT();
  const { pending, run, note } = useRun();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "open" ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => setRequestStatus(id, "fulfilled"))}>{t("rq.mark_fulfilled")}</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRequestStatus(id, "closed"))}>{t("rq.close")}</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setRequestStatus(id, "open"))}>{t("rq.reopen")}</Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(t("rq.confirm_delete")) && run(() => deleteRequest(id))} className="text-danger">{t("rq.delete")}</Button>
      </div>
      {note}
    </div>
  );
}
