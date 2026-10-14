import { cacheLife } from "next/cache";

export type AuthProviders = { google: boolean; phone: boolean };

/**
 * Which sign-in methods actually work right now. A method shows only if its NEXT_PUBLIC_*_LOGIN flag is on AND the
 * Supabase project has that provider enabled (GET /auth/v1/settings). This keeps a "Continue with Google" button from
 * leading to Supabase's "provider is not enabled" error page when the provider isn't set up (e.g. local dev).
 */
export async function getAuthProviders(): Promise<AuthProviders> {
  "use cache";
  cacheLife("minutes");
  const flags = { google: process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true", phone: process.env.NEXT_PUBLIC_PHONE_LOGIN === "true" };
  if (!flags.google && !flags.phone) return flags;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`settings ${res.status}`);
    const { external } = (await res.json()) as { external?: Record<string, boolean> };
    return { google: flags.google && external?.google === true, phone: flags.phone && external?.phone === true };
  } catch (e) {
    // Can't tell: hide the optional methods. Email sign-in always works.
    console.error("getAuthProviders:", e);
    return { google: false, phone: false };
  }
}
