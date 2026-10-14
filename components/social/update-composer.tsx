"use client";

import { Megaphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteUpdate, postUpdate } from "@/app/actions/social";
import { Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";

/** Post a public update to everyone who added you as a friend, optionally pointing to one of your items or jobs. */
export function UpdateComposer({ items }: { items: { value: string; label: string }[] }) {
  const { t } = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2 rounded-2xl border border-border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await postUpdate(body, link || null);
          if (!res.ok) return setMsg({ ok: false, text: res.error === "invalid" ? t("comments.too_short") : res.error && res.error !== "failed" ? res.error : t("common.error") });
          setBody("");
          setLink("");
          setMsg({ ok: true, text: t("updates.posted") });
          router.refresh();
        });
      }}
    >
      <label htmlFor="update-body" className="flex items-center gap-2 font-bold text-brand-dark"><Megaphone size={18} className="text-accent-strong" aria-hidden /> {t("updates.compose_title")}</label>
      <textarea id="update-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} placeholder={t("updates.compose_ph")} className="w-full rounded-xl border border-border bg-white p-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40" />
      <div className="flex flex-wrap items-center gap-2">
        {items.length > 0 && (
          <Select value={link} onChange={(e) => setLink(e.target.value)} aria-label={t("updates.link_label")} className="h-10 w-auto max-w-full flex-1 text-sm">
            <option value="">{t("updates.link_none")}</option>
            {items.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </Select>
        )}
        <button type="submit" disabled={pending || body.trim().length < 2} className="ml-auto inline-flex min-h-10 items-center rounded-xl bg-accent px-5 text-sm font-bold text-brand-dark hover:bg-[#ea6a0c] disabled:opacity-50">{t("updates.post")}</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</p>}
      <p className="text-xs text-muted-foreground">{t("updates.public_note")}</p>
    </form>
  );
}

export function DeleteUpdateButton({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-label={t("updates.delete")} disabled={pending} onClick={() => confirm(t("updates.confirm_delete")) && start(async () => { await deleteUpdate(id); router.refresh(); })} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger">
      <Trash2 size={14} aria-hidden />
    </button>
  );
}
