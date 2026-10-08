import { createAdminClient } from "@/lib/supabase/server";

/**
 * Signs private order files (payment proofs, packing photos, waybills, dispute evidence).
 * Call ONLY with paths read through the signed-in user's own RLS-checked queries,
 * so the caller is already known to be a participant of the order.
 */
export async function signOrderFiles(paths: (string | null | undefined)[], expiresInSeconds = 900): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {};
  const { data } = await createAdminClient().storage.from("order-files").createSignedUrls(unique, expiresInSeconds);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export const isPdf = (path: string) => path.toLowerCase().endsWith(".pdf");
