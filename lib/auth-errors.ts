import type { TFunction } from "@/lib/i18n/shared";

/** Turns a Supabase Auth error into a short, plain message (never the raw technical text). */
export function friendlyAuthError(err: { code?: string; message?: string; status?: number } | null | undefined, t: TFunction): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  if (code === "weak_password" || (msg.includes("password") && (msg.includes("should") || msg.includes("weak") || msg.includes("at least")))) return t("auth.password_weak");
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) return t("auth.already_registered");
  if (code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email")) return t("auth.bad_email");
  if (code === "same_password" || msg.includes("different from the old")) return t("auth.password_same");
  if (err?.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many")) return t("auth.too_many");
  return t("common.error");
}
