"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideBadge, pinFeatured, removeBadge, unpinFeatured, type R } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { FEATURED_KINDS } from "@/lib/social";

function useRun() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<R>) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) return setMsg(res.error === "not_found" ? t("adminb.user_not_found") : res.error && res.error !== "failed" ? res.error : t("common.error"));
      router.refresh();
    });
  return { pending, run, msg };
}

export function BadgeDecision({ id }: { id: string }) {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={t("adminb.note_ph")} aria-label={t("adminb.note_ph")} className="h-10 min-w-48 flex-1" />
      <Button size="sm" disabled={pending} onClick={() => run(() => decideBadge(id, true, note))}>{t("adminb.approve")}</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideBadge(id, false, note))}>{t("adminb.reject")}</Button>
      {msg && <span role="alert" className="text-xs text-danger">{msg}</span>}
    </div>
  );
}

export function RemoveBadgeButton({ userId, badge }: { userId: string; badge: string }) {
  const { t } = useT();
  const { pending, run } = useRun();
  return (
    <button type="button" disabled={pending} onClick={() => confirm(t("adminb.confirm_remove")) && run(() => removeBadge(userId, badge))} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-danger hover:bg-danger-soft">
      {t("adminb.remove")}
    </button>
  );
}

export function UnpinButton({ userId, kind }: { userId: string; kind: string }) {
  const { t } = useT();
  const { pending, run } = useRun();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => unpinFeatured(userId, kind))} className="min-h-9 rounded-lg px-3 text-xs font-semibold text-danger hover:bg-danger-soft">
      {t("adminb.unpin")}
    </button>
  );
}

export function PinForm() {
  const { t } = useT();
  const { pending, run, msg } = useRun();
  const [who, setWho] = useState("");
  const [kind, setKind] = useState<string>("seller");
  const [days, setDays] = useState("30");
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl bg-muted p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => pinFeatured(who, kind, days ? Number(days) : null));
      }}
    >
      <label className="text-sm font-semibold">{t("adminb.who")}<Input value={who} onChange={(e) => setWho(e.target.value)} required placeholder="name@email.com" className="mt-1 w-64" /></label>
      <label className="text-sm font-semibold">{t("adminb.as")}
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-40">
          {FEATURED_KINDS.map((k) => <option key={k} value={k}>{t(`featured.kind.${k}`)}</option>)}
        </Select>
      </label>
      <label className="text-sm font-semibold">{t("adminb.days")}<Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} className="mt-1 w-24" /></label>
      <Button type="submit" disabled={pending}>{t("adminb.pin")}</Button>
      {msg && <span role="alert" className="text-sm text-danger">{msg}</span>}
    </form>
  );
}
