"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LINK_KINDS, normalizeLink } from "@/lib/social-links";
import { createClient } from "@/lib/supabase/server";

export type LinksResult = { ok: boolean; error?: string; bad?: number[] };

/** Saves the member's whole list of social & contact links. Returns which rows (by index) were not valid. */
export async function saveProfileLinks(rows: { kind: string; value: string; label?: string }[]): Promise<LinksResult> {
  const parsed = z
    .array(z.object({ kind: z.enum(LINK_KINDS), value: z.string().max(300), label: z.string().trim().max(40).optional() }))
    .max(15)
    .safeParse(rows);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const clean: { kind: string; value: string; label: string | null }[] = [];
  const bad: number[] = [];
  parsed.data.forEach((r, i) => {
    if (!r.value.trim()) return; // empty rows are just skipped
    const value = normalizeLink(r.kind, r.value);
    if (!value) bad.push(i);
    else clean.push({ kind: r.kind, value, label: r.kind === "other" ? r.label || null : null });
  });
  if (bad.length) return { ok: false, error: "bad_links", bad };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "auth" };
  const { error } = await supabase.rpc("set_profile_links", { p_links: clean });
  if (error) return { ok: false, error: /can't be posted|up to 15/i.test(error.message) ? error.message : "failed" };
  revalidatePath("/account");
  return { ok: true };
}
