"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteListing, setListingCommission, setListingVisibility, updateListingStock } from "@/app/actions/sell";
import { Select } from "@/components/ui/field";
import { STOCK_STATUSES } from "@/lib/domain";
import { priceLabel } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import { thumbUrl } from "@/lib/images";

export type MyListing = {
  id: string;
  title: string;
  price_type: string;
  price_min: number | null;
  price_max: number | null;
  unit: string;
  stock_status: string;
  quantity_on_hand: number | null;
  status: string;
  view_count: number;
  commission_pct: number | null;
  image: string | null;
};

export function MyListingRow({ l }: { l: MyListing }) {
  const { t } = useT();
  const [stock, setStock] = useState(l.stock_status);
  const [qty, setQty] = useState(l.quantity_on_hand?.toString() ?? "");
  const [commission, setCommission] = useState(l.commission_pct?.toString() ?? "");
  const [commissionMsg, setCommissionMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const removed = l.status === "removed";

  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl(l.image)} alt="" width={80} height={80} className="h-20 w-20 shrink-0 rounded-xl bg-muted object-cover" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <Link href={`/listing/${l.id}`} className="block truncate font-semibold hover:underline">
            {l.title}
          </Link>
          <p className="text-sm text-muted-foreground">
            {priceLabel(l, t)} · {t("my.views", { n: l.view_count })}
            {l.status !== "active" && <span className="ml-2 font-semibold text-danger">· {t(`my.status.${l.status}`)}</span>}
          </p>
        </div>
        {!removed && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={t("sell.stock")}
              value={stock}
              disabled={pending}
              className="h-10 w-auto text-sm"
              onChange={(e) => {
                setStock(e.target.value);
                start(async () => {
                  await updateListingStock(l.id, e.target.value, qty === "" ? null : Number(qty));
                });
              }}
            >
              {STOCK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`stock.${s}`)}
                </option>
              ))}
            </Select>
            <input
              aria-label={t("sell.qty")}
              type="number"
              inputMode="numeric"
              min={0}
              value={qty}
              placeholder={t("sell.qty")}
              onChange={(e) => setQty(e.target.value)}
              onBlur={() => start(async () => void (await updateListingStock(l.id, stock, qty === "" ? null : Number(qty))))}
              className="h-10 w-24 rounded-xl border border-border px-2 text-sm"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => void (await setListingVisibility(l.id, l.status === "active" ? "hidden" : "active")))}
              className="min-h-10 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted"
            >
              {l.status === "active" ? t("my.hide") : t("my.show")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(t("my.confirm_delete"))) start(async () => void (await deleteListing(l.id)));
              }}
              className="min-h-10 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft"
            >
              {t("my.delete")}
            </button>
          </div>
        )}
        {!removed && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor={`comm-${l.id}`} className="font-semibold text-brand-dark">{t("aff.commission_label")}</label>
            <input
              id={`comm-${l.id}`}
              type="number"
              inputMode="decimal"
              min={1}
              max={50}
              step={0.5}
              value={commission}
              placeholder={t("aff.commission_off")}
              onChange={(e) => { setCommission(e.target.value); setCommissionMsg(null); }}
              className="h-10 w-24 rounded-xl border border-border px-2"
            />
            <span aria-hidden>%</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const res = await setListingCommission(l.id, commission === "" ? null : Number(commission));
                setCommissionMsg(res.ok ? t("aff.commission_saved") : t("sell.invalid"));
              })}
              className="min-h-10 rounded-xl border border-border px-3 font-semibold hover:bg-muted"
            >
              {t("common.save")}
            </button>
            {commissionMsg && <span role="status" className="text-xs text-muted-foreground">{commissionMsg}</span>}
          </div>
        )}
        {removed && <p className="text-sm text-danger">{t("listing.removed")}</p>}
      </div>
    </li>
  );
}
