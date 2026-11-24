/**
 * Jobs 2.0 P5: explainable match cues (flag jobs2_matching). Uses ONLY job-relevant data: role/title, skills,
 * employment type, work setup and location, pay overlap, freshness and employer verification. Never birthdate,
 * sex, civil status or address. Cues only add reasons; no job is ever hidden or filtered out because of them.
 */
export type MatchProfile = {
  desired_roles?: string | null; skills?: string[] | null; job_types?: string[] | null;
  city_code?: string | null; province_code?: string | null; expected_salary_min?: number | string | null; expected_salary_max?: number | string | null;
};
export type MatchJob = {
  title: string; description?: string | null; qualifications?: string | null; employment_type: string; work_setup: string;
  city_code?: string | null; province_code?: string | null; salary_min?: number | string | null; salary_max?: number | string | null;
  salary_period?: string | null; created_at: string; employer_verified?: boolean;
};
export type MatchReason =
  | { key: "role" } | { key: "skills"; n: number } | { key: "type" } | { key: "remote" } | { key: "near_city" } | { key: "near_province" }
  | { key: "pay" } | { key: "fresh" } | { key: "verified" };

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9ñ+#]+/i).filter((w) => w.length >= 3);
const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));

export function matchReasons(p: MatchProfile | null, j: MatchJob, now = Date.now()): MatchReason[] {
  if (!p) return [];
  const out: MatchReason[] = [];
  const title = j.title.toLowerCase();
  const roles = (p.desired_roles ?? "").split(/[,/\n]/).map((r) => r.trim().toLowerCase()).filter((r) => r.length >= 3);
  if (roles.some((r) => title.includes(r) || words(r).some((w) => title.includes(w)))) out.push({ key: "role" });
  const text = ` ${[j.title, j.description, j.qualifications].filter(Boolean).join(" ").toLowerCase()} `;
  const skills = (p.skills ?? []).map((s) => s.toLowerCase().trim()).filter((s) => s.length >= 2);
  const hit = skills.filter((s) => text.includes(s)).length;
  if (hit > 0) out.push({ key: "skills", n: hit });
  if ((p.job_types ?? []).includes(j.employment_type)) out.push({ key: "type" });
  if (j.work_setup === "remote") out.push({ key: "remote" });
  else if (p.city_code && j.city_code === p.city_code) out.push({ key: "near_city" });
  else if (p.province_code && j.province_code === p.province_code) out.push({ key: "near_province" });
  const wantMin = num(p.expected_salary_min), wantMax = num(p.expected_salary_max), payMin = num(j.salary_min), payMax = num(j.salary_max);
  if ((j.salary_period ?? "month") === "month" && (wantMin != null || wantMax != null) && (payMin != null || payMax != null)) {
    const lo = Math.max(wantMin ?? 0, payMin ?? 0), hi = Math.min(wantMax ?? Infinity, payMax ?? payMin ?? Infinity);
    if (lo <= hi && (payMax ?? payMin ?? 0) >= (wantMin ?? 0)) out.push({ key: "pay" });
  }
  if (now - new Date(j.created_at).getTime() <= 7 * 86_400_000) out.push({ key: "fresh" });
  if (j.employer_verified) out.push({ key: "verified" });
  return out;
}

/** Human-readable text for a reason via the i18n function. */
export function reasonText(r: MatchReason, t: (k: string, v?: Record<string, string | number>) => string) {
  return r.key === "skills" ? t("job5.why.skills", { n: r.n }) : t(`job5.why.${r.key}`);
}

/** Pipeline of application statuses for the timeline (withdrawn / rejected end it early). */
export const TIMELINE = ["submitted", "viewed", "shortlisted", "interview", "hired"] as const;
