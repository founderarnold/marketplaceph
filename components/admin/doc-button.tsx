"use client";

import { FileText } from "lucide-react";
import { useState, useTransition } from "react";
import { getSignedDocUrl } from "@/app/actions/verification";
import { useT } from "@/lib/i18n/client";

/** Opens a private document via a 60-second signed URL. The server logs every open before signing. */
export function DocButton({ kind, id, label }: { kind: "verification" | "evidence"; id: string; label: string }) {
  const { t } = useT();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const res = await getSignedDocUrl(kind, id);
            if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
            else setErr(res.error ?? "error");
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
