"use client";

import { LogIn, LogOut, Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clockNow, deleteLog, saveLog, saveStaff, setStaffActive, type R } from "@/app/actions/staff";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

function useAction() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<R>, okText?: string, onOk?: () => void) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) {
        const text = res.pro ? t("plan.needs_note", { tier: "FLAME Starter" }) : res.error === "invalid" ? t("dtr.invalid") : res.error === "already_in" ? t("dtr.already_in") : res.error && res.error !== "failed" ? res.error : t("common.error");
        return setMsg({ ok: false, text });
      }
      if (okText) setMsg({ ok: true, text: okText });
      onOk?.();
      router.refresh();
    });
  const note = msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm font-medium", msg.ok ? "text-success" : "text-danger")}>{msg.text}</p>;
  return { pending, run, note };
}

export function AddStaffForm() {
  const { t } = useT();
  const { pending, run, note } = useAction();
  const [key, setKey] = useState(0); // remount to clear the fields after a save
  return (
    <form
      key={key}
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const rate = String(fd.get("daily_rate") ?? "");
        run(
          () => saveStaff(null, {
            name: String(fd.get("name") ?? ""),
            position: String(fd.get("position") ?? ""),
            shift_start: String(fd.get("shift_start") ?? ""),
            shift_end: String(fd.get("shift_end") ?? ""),
            daily_rate: rate ? Number(rate) : null,
          }),
          t("dtr.staff_saved"),
          () => setKey((k) => k + 1),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("dtr.name")}><Input name="name" required minLength={2} maxLength={80} /></Field>
        <Field label={t("dtr.position")} hint={t("store.optional")}><Input name="position" maxLength={60} placeholder={t("dtr.position_ph")} /></Field>
        <Field label={t("dtr.shift_start")}><Input name="shift_start" type="time" defaultValue="08:00" /></Field>
        <Field label={t("dtr.shift_end")}><Input name="shift_end" type="time" defaultValue="17:00" /></Field>
        <Field label={t("dtr.daily_rate")} hint={t("dtr.daily_rate_hint")}><Input name="daily_rate" type="number" inputMode="decimal" min={0} step="0.01" placeholder="₱" /></Field>
      </div>
      {note}
      <Button type="submit" disabled={pending}>{t("dtr.add_staff")}</Button>
    </form>
  );
}

export function ClockButton({ staffId, isIn, disabled }: { staffId: string; isIn: boolean; disabled?: boolean }) {
  const { t } = useT();
  const { pending, run, note } = useAction();
  return (
    <div className="space-y-1 text-right">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => run(() => clockNow(staffId))}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-50",
          isIn ? "bg-brand-dark text-white hover:bg-brand" : "bg-accent text-brand-dark hover:bg-[#ea6a0c]",
        )}
      >
        {isIn ? <LogOut size={16} aria-hidden /> : <LogIn size={16} aria-hidden />} {isIn ? t("dtr.time_out") : t("dtr.time_in")}
      </button>
      {note}
    </div>
  );
}

export function LogForm({ staff, today }: { staff: { id: string; name: string }[]; today: string }) {
  const { t } = useT();
  const { pending, run, note } = useAction();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => saveLog(null, {
            staffId: String(fd.get("staff") ?? ""),
            date: String(fd.get("date") ?? ""),
            timeIn: String(fd.get("in") ?? ""),
            timeOut: String(fd.get("out") ?? ""),
            note: String(fd.get("note") ?? ""),
          }),
          t("dtr.log_saved"),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t("dtr.staff")}>
          <Select name="staff" required defaultValue="">
            <option value="" disabled>—</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label={t("dtr.date")}><Input name="date" type="date" required max={today} defaultValue={today} /></Field>
        <Field label={t("dtr.time_in")}><Input name="in" type="time" required /></Field>
        <Field label={t("dtr.time_out")} hint={t("store.optional")}><Input name="out" type="time" /></Field>
        <Field label={t("dtr.note")} hint={t("store.optional")}><Input name="note" maxLength={200} placeholder={t("dtr.note_ph")} /></Field>
      </div>
      {note}
      <Button type="submit" variant="outline" disabled={pending}>{t("dtr.add_log")}</Button>
    </form>
  );
}

export function DeleteLogButton({ id }: { id: string }) {
  const { t } = useT();
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      aria-label={t("dtr.delete_log")}
      disabled={pending}
      onClick={() => confirm(t("dtr.confirm_delete")) && run(() => deleteLog(id))}
      className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-danger-soft print:hidden"
    >
      <Trash2 size={16} aria-hidden />
    </button>
  );
}

export function StaffActiveToggle({ id, active }: { id: string; active: boolean }) {
  const { t } = useT();
  const { pending, run } = useAction();
  return (
    <button type="button" disabled={pending} onClick={() => run(() => setStaffActive(id, !active))} className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted print:hidden">
      {active ? t("dtr.deactivate") : t("dtr.reactivate")}
    </button>
  );
}

export function PrintButton() {
  const { t } = useT();
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-semibold hover:bg-muted print:hidden">
      <Printer size={16} aria-hidden /> {t("calc.print")}
    </button>
  );
}
