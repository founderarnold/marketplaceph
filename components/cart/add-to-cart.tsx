"use client";

import { Minus, Plus, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/orders";
import { openAuth } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

export function AddToCart({ listingId, storeId, moq, unit }: { listingId: string; storeId: string; moq: number; unit: string }) {
  const { t } = useT();
  const router = useRouter();
  // Kept as text while typing (so the field can be cleared and retyped); clamped to the MOQ on blur and on submit.
  const [qtyText, setQtyText] = useState(String(moq));
  const clamp = (v: string | number) => Math.min(1_000_000, Math.max(moq, Math.floor(Number(v)) || moq));
  const qty = clamp(qtyText);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(thenCheckout: boolean) {
    setMsg(null);
    start(async () => {
      const res = await addToCart(listingId, qty);
      if (res.error === "auth") return openAuth();
      if (!res.ok) {
        const text = res.error?.startsWith("moq:") ? t("cart.err_moq", { n: res.error.slice(4), unit }) : res.error === "out_of_stock" ? t("cart.err_oos") : t("common.error");
        return setMsg({ ok: false, text });
      }
      if (thenCheckout) return router.push(`/checkout/${storeId}`);
      setMsg({ ok: true, text: t("cart.added") });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label htmlFor={`qty-${listingId}`} className="block text-sm font-semibold text-brand-dark">{t("cart.quantity")} ({unit})</label>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={t("cart.less")} disabled={qty <= moq} onClick={() => setQtyText(String(qty - 1))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted disabled:opacity-40">
              <Minus size={16} aria-hidden />
            </button>
            <Input id={`qty-${listingId}`} type="number" inputMode="numeric" min={moq} value={qtyText} onChange={(e) => setQtyText(e.target.value)} onBlur={() => setQtyText(String(qty))} className="text-center" />
            <button type="button" aria-label={t("cart.more")} onClick={() => setQtyText(String(qty + 1))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border hover:bg-muted">
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
        <Button variant="outline" disabled={pending} onClick={() => run(false)}>
          <ShoppingCart size={18} aria-hidden /> {t("cart.add")}
        </Button>
      </div>
      <Button variant="accent" size="lg" className="w-full" disabled={pending} onClick={() => run(true)}>
        {t("cart.request_order")}
      </Button>
      {msg && (
        <p role="status" className={`text-sm font-medium ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text} {msg.ok && <Link href="/cart" className="underline">{t("cart.view")}</Link>}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("cart.how_note")}</p>
    </div>
  );
}
