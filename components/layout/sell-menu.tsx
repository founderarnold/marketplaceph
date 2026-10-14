"use client";

import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { FEATURE_MIN_RANK, tierFor } from "@/lib/plans";
import { SELLER_TOOLS, type SellerTool } from "@/lib/seller-tools";
import { cn } from "@/lib/utils";

/**
 * "Sell" in the header's browse bar: a panel with every seller tool, grouped into selling basics and business tools,
 * each marked Free or with the tier that unlocks it. The bar scrolls sideways on phones (overflow clips absolute
 * children), so the panel is position: fixed and placed under the button.
 */
export function SellMenu({ rank }: { rank: number | null }) {
  const { t } = useT();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function toggle() {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      const width = Math.min(640, window.innerWidth - 16);
      setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, [open]);

  const item = (tool: SellerTool) => {
    const Icon = tool.icon;
    const paid = tool.feature ? FEATURE_MIN_RANK[tool.feature] > 0 : false;
    const locked = paid && rank !== null && rank < FEATURE_MIN_RANK[tool.feature!];
    return (
      <li key={tool.key}>
        <Link href={tool.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm text-foreground hover:bg-brand-soft hover:text-brand">
          <Icon size={18} className="shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1 font-semibold">{t(`sell.tool.${tool.key}.title`)}</span>
          {paid && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-accent-strong">
              {locked && <Lock size={10} aria-hidden />}
              {tierFor(tool.feature!).name.replace("FLAME ", "")}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="sell-menu"
        className={cn("flex h-9 items-center gap-1 rounded-lg px-2.5 font-bold hover:bg-white/15", open && "bg-white/15")}
      >
        {t("nav.sell_menu")} <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          ref={panel}
          id="sell-menu"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 max-h-[calc(100dvh-8rem)] w-[min(40rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-border bg-white p-3 text-foreground shadow-2xl"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="px-2.5 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sell.group.basics")}</p>
              <ul>{SELLER_TOOLS.filter((x) => x.group === "basics").map(item)}</ul>
            </div>
            <div>
              <p className="px-2.5 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("sell.group.business")}</p>
              <ul>{SELLER_TOOLS.filter((x) => x.group === "business").map(item)}</ul>
            </div>
          </div>
          <Link href="/sell" onClick={() => setOpen(false)} className="mt-2 flex min-h-11 items-center justify-center gap-1 rounded-xl bg-brand-soft text-sm font-bold text-brand hover:bg-brand hover:text-white">
            {t("sell.see_all")} <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      )}
    </>
  );
}
