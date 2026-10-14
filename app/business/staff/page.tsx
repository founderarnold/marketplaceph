import type { Metadata } from "next";
import { Suspense } from "react";
import { ProNote } from "@/components/business/pro-note";
import { AddStaffForm, ClockButton, DeleteLogButton, LogForm, PrintButton, StaffActiveToggle } from "@/components/business/staff-forms";
import { ToolGuide } from "@/components/sell/tool-guide";
import { ToolHeader } from "@/components/sell/tool-header";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { businessContext, peso } from "@/lib/business";
import { todayPH } from "@/lib/format";
import { cutoffFor, formatMinutes, phTime, shiftLabel, summarizeLog, summarizePeriod } from "@/lib/staff";

export const metadata: Metadata = { title: "Staff time record" };

const dayRe = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const fmtDay = (d: string) => new Date(`${d}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

export default function StaffPage(props: PageProps<"/business/staff">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <Staff searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Staff({ searchParams }: Pick<PageProps<"/business/staff">, "searchParams">) {
  const sp = await searchParams;
  const { supabase, can, t } = await businessContext();
  const allowed = can("staff_dtr");
  const today = todayPH();
  const def = cutoffFor(today);
  let from = dayRe.test(one(sp.from)) ? one(sp.from) : def.from;
  let to = dayRe.test(one(sp.to)) ? one(sp.to) : def.to;
  if (to < from) [from, to] = [to, from];
  const pick = one(sp.staff);

  const [{ data: staff }, { data: open }, { data: logs }] = await Promise.all([
    supabase.from("staff_members").select("id, name, position, shift_start, shift_end, daily_rate, active").order("active", { ascending: false }).order("name"),
    supabase.from("staff_time_logs").select("staff_id, time_in").is("time_out", null),
    supabase.from("staff_time_logs").select("id, staff_id, work_date, time_in, time_out, note").gte("work_date", from).lte("work_date", to).order("work_date").order("time_in").limit(2000),
  ]);
  const people = staff ?? [];
  const active = people.filter((p) => p.active);
  const openBy = new Map((open ?? []).map((o) => [o.staff_id, o.time_in]));
  const shown = people.filter((p) => (pick ? p.id === pick : true));

  if (!allowed && people.length === 0) {
    return (
      <div className="space-y-4">
        <ToolHeader toolKey="staff_dtr" t={t} />
        <ToolGuide toolKey="staff_dtr" t={t} open />
        <ProNote t={t} need="staff_dtr" feature={t("sell.locked_body")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToolHeader toolKey="staff_dtr" t={t} />
      <ToolGuide toolKey="staff_dtr" t={t} open={people.length === 0} className="print:hidden" />
      {!allowed && <ProNote t={t} need="staff_dtr" feature={t("dtr.read_only")} className="print:hidden" />}

      {/* Today: one-tap time in / time out */}
      <section aria-labelledby="today-h" className="space-y-3 print:hidden">
        <h2 id="today-h" className="text-lg font-bold text-brand-dark">{t("dtr.today", { date: fmtDay(today) })}</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("dtr.no_staff")}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {active.map((p) => {
              const since = openBy.get(p.id);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-brand-dark">{p.name}</p>
                    <p className={since ? "text-sm font-semibold text-success" : "text-sm text-muted-foreground"}>
                      {since ? t("dtr.in_since", { time: phTime(since) }) : p.position || t("dtr.not_in")}
                    </p>
                  </div>
                  <ClockButton staffId={p.id} isIn={!!since} disabled={!allowed} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Records for a pay period */}
      <section aria-labelledby="rec-h" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="rec-h" className="text-lg font-bold text-brand-dark">{t("dtr.records")}</h2>
            <p className="text-sm text-muted-foreground">{fmtDay(from)} – {fmtDay(to)}</p>
          </div>
          <PrintButton />
        </div>
        <form className="flex flex-wrap items-end gap-2 rounded-2xl bg-muted p-3 print:hidden">
          <label className="text-sm font-semibold">{t("dtr.from")}<Input name="from" type="date" defaultValue={from} className="mt-1 w-40" /></label>
          <label className="text-sm font-semibold">{t("dtr.to")}<Input name="to" type="date" defaultValue={to} className="mt-1 w-40" /></label>
          <label className="text-sm font-semibold">{t("dtr.staff")}
            <Select name="staff" defaultValue={pick} className="mt-1 w-48">
              <option value="">{t("filters.all")}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </label>
          <button className={buttonClass("primary", "md")}>{t("dtr.show")}</button>
        </form>

        {shown.map((p) => {
          const mine = (logs ?? []).filter((l) => l.staff_id === p.id);
          if (!mine.length && pick !== p.id) return null;
          const shift = { shift_start: p.shift_start, shift_end: p.shift_end };
          const sum = summarizePeriod(mine, shift);
          return (
            <article key={p.id} className="break-inside-avoid space-y-2 rounded-2xl border border-border bg-white p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-extrabold text-brand-dark">
                  {p.name} {p.position && <span className="text-sm font-normal text-muted-foreground">· {p.position}</span>}
                  {!p.active && <span className="ml-2 rounded bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{t("dtr.inactive")}</span>}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {p.shift_start && p.shift_end ? t("dtr.shift", { start: shiftLabel(p.shift_start), end: shiftLabel(p.shift_end) }) : t("dtr.no_shift")}
                </p>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr><th className="py-1 pr-2 font-semibold">{t("dtr.date")}</th><th className="pr-2 font-semibold">{t("dtr.time_in")}</th><th className="pr-2 font-semibold">{t("dtr.time_out")}</th><th className="pr-2 font-semibold">{t("dtr.hours")}</th><th className="pr-2 font-semibold">{t("dtr.late")}</th><th className="pr-2 font-semibold">{t("dtr.undertime")}</th><th className="font-semibold">{t("dtr.note")}</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mine.map((l) => {
                      const s = summarizeLog(l, shift);
                      return (
                        <tr key={l.id}>
                          <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDay(l.work_date)}</td>
                          <td className="pr-2 whitespace-nowrap">{phTime(l.time_in)}</td>
                          <td className="pr-2 whitespace-nowrap">{l.time_out ? phTime(l.time_out) : <span className="font-semibold text-success">{t("dtr.still_in")}</span>}</td>
                          <td className="pr-2">{s.open ? "—" : formatMinutes(s.worked)}</td>
                          <td className={s.late ? "pr-2 font-semibold text-danger" : "pr-2"}>{s.late ? formatMinutes(s.late) : "—"}</td>
                          <td className={s.undertime ? "pr-2 font-semibold text-accent-strong" : "pr-2"}>{s.undertime ? formatMinutes(s.undertime) : "—"}</td>
                          <td className="max-w-40 truncate text-muted-foreground">{l.note}</td>
                          <td className="text-right">{allowed && <DeleteLogButton id={l.id} />}</td>
                        </tr>
                      );
                    })}
                    {!mine.length && <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">{t("dtr.no_logs")}</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 text-sm">
                <span>{t("dtr.days")}: <b>{sum.days}</b></span>
                <span>{t("dtr.total_hours")}: <b>{formatMinutes(sum.worked)}</b></span>
                <span>{t("dtr.late")}: <b>{formatMinutes(sum.late)}</b></span>
                <span>{t("dtr.undertime")}: <b>{formatMinutes(sum.undertime)}</b></span>
                {p.daily_rate != null && <span>{t("dtr.est_pay")}: <b>{peso(sum.days * Number(p.daily_rate))}</b></span>}
              </p>
            </article>
          );
        })}
        {(logs ?? []).length === 0 && !pick && <p className="rounded-2xl bg-muted p-5 text-center text-sm text-muted-foreground">{t("dtr.no_logs")}</p>}
        <p className="text-xs text-muted-foreground">{t("dtr.pay_note")}</p>
      </section>

      {allowed && (
        <div className="grid gap-4 print:hidden">
          {active.length > 0 && (
            <section aria-labelledby="man-h" className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <h2 id="man-h" className="font-bold text-brand-dark">{t("dtr.manual")}</h2>
              <p className="text-sm text-muted-foreground">{t("dtr.manual_hint")}</p>
              <LogForm staff={active.map((p) => ({ id: p.id, name: p.name }))} today={today} />
            </section>
          )}
          <section aria-labelledby="add-h" className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <h2 id="add-h" className="font-bold text-brand-dark">{t("dtr.add_staff")}</h2>
            <AddStaffForm />
          </section>
          {people.length > 0 && (
            <section aria-labelledby="list-h" className="space-y-2 rounded-2xl border border-border bg-white p-4">
              <h2 id="list-h" className="font-bold text-brand-dark">{t("dtr.staff_list")}</h2>
              <ul className="divide-y divide-border">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className={p.active ? "" : "text-muted-foreground line-through"}>
                      <b>{p.name}</b>{p.position && ` · ${p.position}`}{p.daily_rate != null && ` · ${peso(p.daily_rate)}/${t("dtr.day")}`}
                    </span>
                    <StaffActiveToggle id={p.id} active={p.active} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
