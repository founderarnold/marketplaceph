/**
 * Verified Professional Account (job applicants). The documents rule below is the same one the database checks in
 * pro_docs_complete() (20261125000009): a job profile shared for applying, a resume, an ID photo and one clearance.
 * The badge itself is granted only by a full admin after a face-to-face interview by an appointed or accredited
 * FLAME PH partner (record_pro_interview + review_badge_request).
 */
export const PRO_BADGE = "verified_professional" as const;
export const PRO_PARTNER_KINDS = ["appointed", "accredited"] as const;
export const PRO_RESULTS = ["passed", "not_passed"] as const;

export type ProCheck = { key: "profile" | "resume" | "photo" | "clearance"; ok: boolean };

export function proChecklist(profile: { consent_at?: string | null } | null, docs: { kind: string }[]): { items: ProCheck[]; complete: boolean } {
  const has = (...kinds: string[]) => docs.some((d) => kinds.includes(d.kind));
  const items: ProCheck[] = [
    { key: "profile", ok: !!profile?.consent_at },
    { key: "resume", ok: has("resume") },
    { key: "photo", ok: has("photo_2x2", "photo_half_body") },
    { key: "clearance", ok: has("nbi_clearance", "police_clearance", "barangay_clearance") },
  ];
  return { items, complete: items.every((i) => i.ok) };
}
