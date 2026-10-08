"use client";

import { Printer, Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export function SheetActions({ title }: { title: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const btn = "btn inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 font-semibold";
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button type="button" className={btn} onClick={() => window.print()}>
        <Printer size={18} aria-hidden /> {t("sheet.print")}
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          if (navigator.share) {
            try {
              await navigator.share({ title, url: location.href });
              return;
            } catch {
              /* fall through to copy */
            }
          }
          await navigator.clipboard?.writeText(location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        <Share2 size={18} aria-hidden /> {copied ? t("share.copied") : t("share.share")}
      </button>
    </div>
  );
}
