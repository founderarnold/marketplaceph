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

/** Starter job drafts mark text the admin must replace with this; such posts cannot be published (see scripts/starter-jobs.mjs). */
export const ADMIN_PLACEHOLDER = "[ADMIN TO FILL";
export const hasAdminPlaceholder = (...texts: (string | null | undefined)[]) => texts.some((x) => !!x && x.includes(ADMIN_PLACEHOLDER));

/** Applicant-friendly wording used when a draft is published with details still blank. */
export const PUBLISH_DEFAULTS = {
  pay: "Salary: to be discussed during the interview",
  commission: "Commission-based; details discussed during the interview",
  location: "Location to be confirmed by the employer",
} as const;

/**
 * Replaces every "[ADMIN TO FILL …]" note with clean wording so no placeholder is ever shown publicly.
 * Pay / Earnings / Location lines get the defaults above; any other note is removed. Everything else
 * (no-fee notice, PRC note, partner labels) is kept as written.
 */
export function cleanAdminPlaceholders(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (!text.includes(ADMIN_PLACEHOLDER)) return text;
  const note = /\[ADMIN TO FILL[^\]]*\]/g;
  const lines = text.split("\n").flatMap((line) => {
    if (!line.includes(ADMIN_PLACEHOLDER)) return [line];
    const label = line.trim().toLowerCase();
    if (label.startsWith("pay range:") || label.startsWith("pay:") || label.startsWith("salary:")) return [PUBLISH_DEFAULTS.pay];
    if (label.startsWith("earnings:") || label.startsWith("commission:")) return [PUBLISH_DEFAULTS.commission];
    if (label.startsWith("location:")) return [PUBLISH_DEFAULTS.location];
    const rest = line.replace(note, "").replace(/\s{2,}/g, " ").trimEnd();
    return rest.trim() === "" || /:\s*$/.test(rest) ? [] : [rest];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

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
