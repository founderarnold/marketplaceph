"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayPH } from "@/lib/format";
import { isProError } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

/* Staff Daily Time Record. RLS keeps everything owner-only; the database enforces the FLAME Starter requirement. */

export type R = { ok: boolean; error?: string; pro?: boolean };

const PATH = "/business/staff";
const uuid = z.uuid();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** A Philippine wall-clock date + time as an absolute instant (PH has no daylight saving: always +08:00). */
const atPH = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).toISOString();

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: (data?.claims?.sub as string | undefined) ?? null };
}
function fail(e: { code?: string; message?: string } | null): R {
  if (isProError(e)) return { ok: false, pro: true, error: "pro" };
  if (e?.message?.includes("staff_time_logs_one_open")) return { ok: false, error: "already_in" };
  if (e?.message?.includes("Staff list is full")) return { ok: false, error: e.message };
  return { ok: false, error: "failed" };
}
const done = (): R => {
  revalidatePath(PATH);
  return { ok: true };
};

const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  position: z.string().trim().max(60).optional(),
  shift_start: hhmm.optional().or(z.literal("")),
  shift_end: hhmm.optional().or(z.literal("")),
  daily_rate: z.union([z.number().min(0).max(1_000_000), z.null()]).optional(),
});

export async function saveStaff(id: string | null, input: z.input<typeof staffSchema>): Promise<R> {
  const p = staffSchema.safeParse(input);
  if (!p.success || (id && !uuid.safeParse(id).success)) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const row = {
    name: p.data.name,
    position: p.data.position || null,
    shift_start: p.data.shift_start || null,
    shift_end: p.data.shift_end || null,
    daily_rate: p.data.daily_rate ?? null,
  };
  const { error } = id
    ? await supabase.from("staff_members").update(row).eq("id", id)
    : await supabase.from("staff_members").insert({ ...row, owner_id: userId });
  return error ? fail(error) : done();
}

export async function setStaffActive(id: string, active: boolean): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("staff_members").update({ active }).eq("id", id);
  return error ? fail(error) : done();
}

/** One tap: time in now (opens a log) or time out now (closes the open one). */
export async function clockNow(staffId: string): Promise<R> {
  if (!uuid.safeParse(staffId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const { data: open } = await supabase.from("staff_time_logs").select("id").eq("staff_id", staffId).is("time_out", null).maybeSingle();
  const now = new Date().toISOString();
  const { error } = open
    ? await supabase.from("staff_time_logs").update({ time_out: now }).eq("id", open.id)
    : await supabase.from("staff_time_logs").insert({ owner_id: userId, staff_id: staffId, work_date: todayPH(), time_in: now });
  return error ? fail(error) : done();
}

const logSchema = z
  .object({ staffId: uuid, date: day, timeIn: hhmm, timeOut: hhmm.optional().or(z.literal("")), note: z.string().trim().max(200).optional() })
  .refine((v) => !v.timeOut || v.timeOut > v.timeIn, { path: ["timeOut"] });

/** Manual entry or correction (e.g. a forgotten time-out). Overnight shifts are not supported: time out must be later the same day. */
export async function saveLog(id: string | null, input: z.input<typeof logSchema>): Promise<R> {
  const p = logSchema.safeParse(input);
  if (!p.success || (id && !uuid.safeParse(id).success)) return { ok: false, error: "invalid" };
  const { supabase, userId } = await ctx();
  if (!userId) return { ok: false, error: "auth" };
  const v = p.data;
  const row = { staff_id: v.staffId, work_date: v.date, time_in: atPH(v.date, v.timeIn), time_out: v.timeOut ? atPH(v.date, v.timeOut) : null, note: v.note || null };
  const { error } = id
    ? await supabase.from("staff_time_logs").update(row).eq("id", id)
    : await supabase.from("staff_time_logs").insert({ ...row, owner_id: userId });
  return error ? fail(error) : done();
}

export async function deleteLog(id: string): Promise<R> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await ctx();
  const { error } = await supabase.from("staff_time_logs").delete().eq("id", id);
  return error ? fail(error) : done();
}
