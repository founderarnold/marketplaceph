export type Cell = string | number | null | undefined;
export type Table = { title: string; subtitle?: string; columns: string[]; rows: Cell[][]; totals?: Cell[] };

/**
 * Spreadsheet apps treat cells that start with = + - @ (or a tab/CR) as formulas. User-entered text (customer names,
 * notes, vendors…) could abuse that, so text cells are neutralised with a leading apostrophe. Real numbers are untouched.
 */
export function safeCell(v: Cell): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** UTF-8 CSV with a BOM so Excel opens "₱" and Filipino characters correctly. */
export function toCsv(t: Table): string {
  const lines = [t.columns.map(csvField).join(",")];
  for (const row of t.rows) lines.push(row.map((c) => csvField(safeCell(c))).join(","));
  if (t.totals) lines.push(t.totals.map((c) => csvField(safeCell(c))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function fileStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Parses ?from=YYYY-MM-DD&to=… with safe defaults (this month so far). */
export function parseRange(from: string | null | undefined, to: string | null | undefined, now = new Date()): { from: string; to: string } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const today = fileStamp(now);
  const first = `${today.slice(0, 8)}01`;
  const f = from && iso.test(from) && !Number.isNaN(Date.parse(from)) ? from : first;
  const t = to && iso.test(to) && !Number.isNaN(Date.parse(to)) ? to : today;
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}
