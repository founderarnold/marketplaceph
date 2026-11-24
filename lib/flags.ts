import "server-only";

/**
 * Jobs 2.0 feature flags. Everything is OFF unless named in the JOBS2_FLAGS environment variable, e.g.
 *   JOBS2_FLAGS=jobs2_landing,jobs2_matching
 * Turning a flag off (removing it and redeploying) restores the previous behaviour; no data is changed.
 * Server-only on purpose: pages decide what to render, so a flag can never be switched on from the browser.
 */
export const JOBS2_FLAGS = [
  "jobs2_landing", // P2: /jobs landing, location search, zero-match actions, attribution and landing events
  "jobs2_sso_link", // P3: onboarding shell and honest FLAME PH account copy (never changes SSO logic)
  "jobs2_profile_wizard", // P4
  "jobs2_resume_builder", // P4
  "jobs2_matching", // P5
  "jobs2_employer_pipeline", // P6
] as const;
export type Jobs2Flag = (typeof JOBS2_FLAGS)[number];

/** Parses a JOBS2_FLAGS value; unknown names are ignored. Exported for tests. */
export function parseFlags(raw: string | undefined): Set<Jobs2Flag> {
  const names = (raw ?? "").split(",").map((s) => s.trim().toLowerCase());
  return new Set(JOBS2_FLAGS.filter((f) => names.includes(f)));
}

export function isOn(flag: Jobs2Flag): boolean {
  return parseFlags(process.env.JOBS2_FLAGS).has(flag);
}
