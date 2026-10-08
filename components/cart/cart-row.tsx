"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCartItem, updateCartQty } from "@/app/actions/orders";
import { useT } from "@/lib/i18n/client";

export function CartQty({ itemId, quantity, moq }: { itemId: string; quantity: number; moq: number }) {
  const { t } = useT();
  const router = useRouter();
  const [qty, setQty] = useState(String(quantity));
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={t("cart.quantity")}
        type="number"
        inputMode="numeric"
        min={moq}
        value={qty}
        disabled={pending}
        onChange={(e) => setQty(e.target.value)}
        onBlur={() => {
          const n = Math.max(moq, Number(qty) || moq);
          setQty(String(n));
          if (n !== quantity) start(async () => { await updateCartQty(itemId, n); router.refresh(); });
        }}
        className="h-10 w-24 rounded-xl border border-border px-2 text-base"
      />
      <button
        type="button"
        aria-label={t("upload.remove")}
        disabled={pending}
        onClick={() => start(async () => { await removeCartItem(itemId); router.refresh(); })}
        className="grid h-10 w-10 place-items-center rounded-xl text-danger hover:bg-danger-soft"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    </div>
  );
}
