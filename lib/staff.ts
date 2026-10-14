/** Staff Daily Time Record maths. All wall-clock values are Philippine time (UTC+8, no daylight saving). */

const TZ = "Asia/Manila";

/** "08:05" for an instant, in Philippine time. */
export function phClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Minutes since midnight for "HH:MM" (or "HH:MM:SS" as Postgres returns `time`). */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export type DayLog = { time_in: string; time_out: string | null };
export type Shift = { shift_start: string | null; shift_end: string | null };
export type DaySummary = { worked: number; late: number; undertime: number; open: boolean };

/** Worked, late and undertime minutes for one log. An open log (no time out yet) counts as 0 worked. */
export function summarizeLog(log: DayLog, shift: Shift): DaySummary {
  const inMin = toMinutes(phClock(log.time_in));
  const open = !log.time_out;
  const worked = open ? 0 : Math.max(0, Math.round((new Date(log.time_out!).getTime() - new Date(log.time_in).getTime()) / 60000));
  const late = shift.shift_start ? Math.max(0, inMin - toMinutes(shift.shift_start)) : 0;
  const undertime = !open && shift.shift_end ? Math.max(0, toMinutes(shift.shift_end) - toMinutes(phClock(log.time_out!))) : 0;
  return { worked, late, undertime, open };
}

/** Totals over many logs; `days` counts distinct work dates. */
export function summarizePeriod(logs: (DayLog & { work_date: string })[], shift: Shift) {
  let worked = 0, late = 0, undertime = 0;
  const days = new Set<string>();
  for (const l of logs) {
    const s = summarizeLog(l, shift);
    worked += s.worked;
    late += s.late;
    undertime += s.undertime;
    days.add(l.work_date);
  }
  return { worked, late, undertime, days: days.size };
}

/** 485 → "8h 05m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Payroll-style cut-off containing `date`: 1–15 or 16–end of month. Returns YYYY-MM-DD bounds. */
export function cutoffFor(date: string): { from: string; to: string } {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return d <= 15 ? { from: `${y}-${mm}-01`, to: `${y}-${mm}-15` } : { from: `${y}-${mm}-16`, to: `${y}-${mm}-${last}` };
}

/** "1:07 AM" for an instant, in Philippine time (for display; maths uses phClock). */
export function phTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "8:00 AM" for a stored shift time like "08:00:00". */
export function shiftLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
