/**
 * Career Readiness for Jobs 2.0 (P3 onboarding shell, reused by the P4 wizard). Derived ONLY from existing saved
 * fields: nothing new is stored. Birthdate, sex, civil status and the street address are never read here, so they
 * can never affect readiness (or matching, which reuses this).
 */
export type ReadinessInput = {
  desired_roles?: string | null;
  phone?: string | null;
  contact_email?: string | null;
  city_code?: string | null;
  province_code?: string | null;
  skills?: string[] | null;
  work_history?: unknown[] | null;
  experience_years?: number | null;
  about?: string | null;
  headline?: string | null;
  consent_at?: string | null;
};

export type StepKey = "goal" | "skills" | "experience" | "summary" | "privacy";
export type Step = { n: 1 | 2 | 3 | 4 | 5; key: StepKey; done: boolean; missing: string[] };

/** Fields readiness may read. Tests assert sensitive fields are not in this list. */
export const READINESS_FIELDS = ["desired_roles", "phone", "contact_email", "city_code", "province_code", "skills", "work_history", "experience_years", "about", "headline", "consent_at"] as const;

const filled = (s?: string | null) => !!s && s.trim().length > 0;

export function readiness(p: ReadinessInput | null, docs: { kind: string }[] = []): { steps: Step[]; done: number; next: Step | null } {
  const x = p ?? {};
  const missing = (pairs: [boolean, string][]) => pairs.filter(([ok]) => !ok).map(([, key]) => key);
  const steps: Step[] = [
    { n: 1, key: "goal", missing: missing([[filled(x.desired_roles), "goal_roles"], [filled(x.phone) || filled(x.contact_email), "goal_contact"], [filled(x.city_code) || filled(x.province_code), "goal_location"]]), done: false },
    { n: 2, key: "skills", missing: missing([[(x.skills?.length ?? 0) >= 3, "skills_three"]]), done: false },
    { n: 3, key: "experience", missing: missing([[(x.work_history?.length ?? 0) > 0 || x.experience_years != null, "experience_any"]]), done: false },
    { n: 4, key: "summary", missing: missing([[filled(x.headline), "summary_headline"], [(x.about?.trim().length ?? 0) >= 60, "summary_about"]]), done: false },
    { n: 5, key: "privacy", missing: missing([[!!x.consent_at, "privacy_consent"], [docs.some((d) => d.kind === "resume"), "privacy_resume"]]), done: false },
  ];
  for (const s of steps) s.done = s.missing.length === 0;
  return { steps, done: steps.filter((s) => s.done).length, next: steps.find((s) => !s.done) ?? null };
}
