"use client";

import { FileText } from "lucide-react";
import { useState, useTransition } from "react";
import { getAdminOrderFileUrl } from "@/app/actions/admin";
import { useT } from "@/lib/i18n/client";

/** Admin-only: opens a payment proof / packing photo / dispute file via a logged, 60-second signed URL. */
export function OrderFileButton({ kind, id, label }: { kind: "payment" | "packing" | "evidence" | "waybill"; id: string; label: string }) {
  const { t } = useT();
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(false);
            const res = await getAdminOrderFileUrl(kind, id);
            if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
            else setErr(true);
          })
        }
        className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-white px-2.5 text-xs font-semibold text-brand-dark hover:bg-muted disabled:opacity-60"
      >
        <FileText size={13} aria-hidden /> {label}
      </button>
      {err && <span role="alert" className="text-xs text-danger">{t("common.error")}</span>}
    </span>
  );
}
