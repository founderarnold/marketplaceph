"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCart } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

export function AddToCart({ listingId, storeId, moq, unit }: { listingId: string; storeId: string; moq: number; unit: string }) {
  const { t } = useT();
  const router = useRouter();
  const [qty, setQty] = useState(moq);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run(thenCheckout: boolean) {
    setMsg(null);
    start(async () => {
      const res = await addToCart(listingId, qty);
      if (res.error === "auth") return router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
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
        <label className="block flex-1 space-y-1">
          <span className="text-sm font-semibold text-brand-dark">{t("cart.quantity")} ({unit})</span>
          <Input type="number" inputMode="numeric" min={moq} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || moq))} />
        </label>
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
