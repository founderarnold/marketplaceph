"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileLinks } from "@/app/actions/profile-links";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { LINK_KINDS, LINK_SPECS, type LinkKind } from "@/lib/social-links";
import { cn } from "@/lib/utils";

type Row = { kind: LinkKind; value: string; label: string };

/** Edit the social & contact links shown publicly on your store, items, job posts and buyer page. */
export function ProfileLinksForm({ initial }: { initial: { kind: string; value: string; label: string | null }[] }) {
  const { t } = useT();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.length ? initial.map((l) => ({ kind: l.kind as LinkKind, value: l.value, label: l.label ?? "" })) : [{ kind: "facebook_page", value: "", label: "" }],
  );
  const [bad, setBad] = useState<number[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        setBad([]);
        start(async () => {
          const res = await saveProfileLinks(rows);
          if (!res.ok) {
            if (res.bad) setBad(res.bad);
            return setMsg({ ok: false, text: res.error === "bad_links" ? t("links.bad") : res.error && !["failed", "invalid"].includes(res.error) ? res.error : t("common.error") });
          }
          setMsg({ ok: true, text: t("links.saved") });
          router.refresh();
        });
      }}
    >
      <div>
        <h2 className="font-bold text-brand-dark">{t("links.edit_title")}</h2>
        <p className="text-sm text-muted-foreground">{t("links.edit_intro")}</p>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className={cn("flex flex-wrap items-center gap-2 rounded-xl p-1", bad.includes(i) && "bg-danger-soft")}>
            <Select aria-label={t("links.type")} value={r.kind} onChange={(e) => set(i, { kind: e.target.value as LinkKind })} className="h-11 w-44 shrink-0">
              {LINK_KINDS.map((k) => <option key={k} value={k}>{t(`links.kind.${k}`)}</option>)}
            </Select>
            {r.kind === "other" && (
              <Input aria-label={t("links.label")} value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={40} placeholder={t("links.label_ph")} className="w-36 shrink-0" />
            )}
            <Input
              aria-label={t("links.value")}
              aria-invalid={bad.includes(i) || undefined}
              value={r.value}
              onChange={(e) => set(i, { value: e.target.value })}
              maxLength={300}
              inputMode={LINK_SPECS[r.kind].input === "phone" ? "tel" : "url"}
              placeholder={LINK_SPECS[r.kind].placeholder}
              className="min-w-48 flex-1"
            />
            <button type="button" aria-label={t("upload.remove")} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-danger hover:bg-danger-soft">
              <Trash2 size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {rows.length < 15 && (
        <button type="button" onClick={() => setRows((x) => [...x, { kind: "website", value: "", label: "" }])} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
          <Plus size={16} aria-hidden /> {t("links.add")}
        </button>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm font-medium", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("links.public_note")}</p>
        <Button type="submit" disabled={pending}>{t("common.save")}</Button>
      </div>
    </form>
  );
}
