"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type R = { ok: boolean; error?: string };

/** Surface only our own workflow messages; everything else becomes a generic error. */
const safe = (m?: string) => (m && /window|already|appeal|chance|closed|not open|not found/i.test(m) ? m : "failed");

export async function respondToCase(reportId: string, body: string, paths: string[]): Promise<R> {
  const parsed = z.object({ id: z.uuid(), body: z.string().trim().min(5).max(3000), paths: z.array(z.string().max(300)).max(4) }).safeParse({ id: reportId, body, paths });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_case_response", { p_report: parsed.data.id, p_body: parsed.data.body, p_paths: parsed.data.paths });
  if (error) return { ok: false, error: safe(error.message) };
  revalidatePath("/my/cases");
  return { ok: true };
}

export async function appealCase(reportId: string, body: string): Promise<R> {
  const parsed = z.object({ id: z.uuid(), body: z.string().trim().min(10).max(3000) }).safeParse({ id: reportId, body });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("file_appeal", { p_report: parsed.data.id, p_body: parsed.data.body });
  if (error) return { ok: false, error: error.code === "23505" ? "already" : safe(error.message) };
  revalidatePath("/my/cases");
  return { ok: true };
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/notifications");
}
