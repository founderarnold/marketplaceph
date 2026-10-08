"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { setLocale } from "@/app/actions/locale";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function updateProfile(_prev: { ok?: boolean; error?: string } | undefined, fd: FormData) {
  const parsed = z
    .object({
      display_name: z.string().trim().min(1).max(80),
      locale: z.enum(["en", "fil"]),
      sheet_public: z.preprocess((v) => v === "on", z.boolean()),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "invalid" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) redirect("/login");
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", id);
  if (error) return { error: "failed" };
  await setLocale(parsed.data.locale); // keep the UI language in sync with the saved preference
  revalidatePath("/account");
  return { ok: true };
}

/**
 * Right to erasure (RA 10173). Deletes the auth user; every owned row cascades
 * (profile, store, listings, favorites, conversations, messages, reports filed).
 * Requires the SUPABASE_SERVICE_ROLE_KEY server env var.
 */
export async function deleteMyAccount(confirmation: string) {
  if (confirmation !== "DELETE") return { error: "confirm" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) redirect("/login");
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { error: "failed" };
  } catch {
    return { error: "unavailable" };
  }
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
