/**
 * Normalise a Philippine mobile number to E.164 (+639XXXXXXXXX).
 * Accepts 09171234567, 9171234567, 639171234567, +639171234567 (spaces/dashes ignored).
 */
export function normalizePhonePH(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^09\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^9\d{9}$/.test(digits)) national = digits;
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2);
  else return null;
  return `+63${national}`;
}

/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
