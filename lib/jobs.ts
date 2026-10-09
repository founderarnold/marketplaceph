/** Jobs marketplace: shared lists (their labels live in messages/*.json as job.<group>.<value>) and small helpers. */
export const JOB_CATEGORIES = [
  "admin_office", "sales_marketing", "customer_service", "food_hospitality", "retail", "logistics_driving", "construction_trades",
  "manufacturing", "agriculture", "it_tech", "education", "healthcare", "security_cleaning", "household_domestic", "creative_media",
  "finance_accounting", "other",
] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "project", "internship", "freelance"] as const;
export const WORK_SETUPS = ["onsite", "remote", "hybrid"] as const;
export const SALARY_PERIODS = ["hour", "day", "month", "project"] as const;
export const EDUCATION_LEVELS = ["elementary", "high_school", "senior_high", "vocational", "college_undergrad", "college_grad", "postgrad"] as const;
export const SEX_OPTIONS = ["male", "female", "prefer_not"] as const;
export const CIVIL_STATUSES = ["single", "married", "widowed", "separated"] as const;
export const POSTER_TYPES = ["employer", "agency"] as const;
export const DOC_KINDS = [
  "photo_2x2", "photo_half_body", "resume", "barangay_clearance", "police_clearance", "nbi_clearance", "transcript",
  "employment_certificate", "diploma", "license_certificate", "other",
] as const;
export const APPLICATION_STATUSES = ["submitted", "viewed", "shortlisted", "interview", "rejected", "hired", "withdrawn"] as const;
export const EMPLOYER_STATUSES = ["viewed", "shortlisted", "interview", "rejected", "hired"] as const;
export const POST_STATUSES = ["active", "closed", "hidden", "removed"] as const;

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
export const DOC_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type DocKind = (typeof DOC_KINDS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const peso = (n: number) => "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 });

/** "₱14,000 – ₱16,000 / month", "₱450 / day", or null when the employer left pay blank. */
export function salaryLabel(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
  period: string | null | undefined,
  per: (p: string) => string,
): string | null {
  const a = min == null ? null : Number(min);
  const b = max == null ? null : Number(max);
  if (a == null && b == null) return null;
  const range = a != null && b != null && a !== b ? `${peso(a)} – ${peso(b)}` : peso((a ?? b) as number);
  return period ? `${range} / ${per(period)}` : range;
}

/** Splits "a, b ,c" into at most `max` unique, trimmed items. */
export function splitList(input: string, max = 20, maxLen = 40): string[] {
  return [...new Set(input.split(/[,\n]/).map((x) => x.trim().slice(0, maxLen)).filter(Boolean))].slice(0, max);
}

export function ageFrom(birthdate: string | null | undefined, now = Date.now()): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate).getTime();
  if (Number.isNaN(b)) return null;
  return Math.floor((now - b) / (365.25 * 86_400_000));
}
