import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REVIEW_DOCS } from "@/lib/jobs-reviews";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const E = en as Record<string, string>;
const F = fil as Record<string, string>;

describe("employer pipeline (jobs2_employer_pipeline)", () => {
  const page = read("app/jobs/employer/[id]/page.tsx");
  it("hides age, sex and civil status from employers when on, and uses existing statuses for counts/filters", () => {
    expect(page).toMatch(/const pipeline = isOn\("jobs2_employer_pipeline"\)/);
    expect(page).toMatch(/\{!pipeline && age != null && <li>/);
    expect(page).toMatch(/APPLICATION_STATUSES as readonly string\[\]\)\.includes\(sp\.status\)/);
  });
  it("interview invites go through the existing status function and say no fees", () => {
    const invite = read("components/jobs2/interview-invite.tsx");
    expect(invite).toMatch(/setApplicationStatus\(id, "interview", note\)/);
    expect(E["job6.invite_note"]).toMatch(/No fees/);
  });
});

describe("employer verification reviews", () => {
  const sql = read("supabase/migrations/20261125000003_jobs2_employer_reviews.sql");
  it("is additive, admin-only, append-only, and agencies need a checked licence", () => {
    expect(sql).toMatch(/create table public\.employer_reviews/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/using \(public\.is_full_admin\(\)\)/);
    expect(sql).not.toMatch(/for update|for delete|drop table|alter table public\.(?!employer_reviews)/i);
    expect(sql).toMatch(/not is_agency or decision <> 'approved' or agency_license_checked/);
    for (const d of REVIEW_DOCS) expect(sql).toContain(`'${d}'`);
  });
  it("the queue never hides or deletes posts and the badge stays in the existing approval flow", () => {
    const q = read("app/admin/employer-reviews/page.tsx");
    expect(q).not.toMatch(/\.update\(|\.delete\(/);
    expect(q).toMatch(/href="\/admin\?tab=badges"/);
    expect(read("app/actions/jobs2.ts")).not.toMatch(/from\("user_badges"\)\.insert/);
  });
  it("all job6 strings exist in Filipino", () => {
    for (const k of Object.keys(E).filter((k) => k.startsWith("job6."))) expect(F[k], k).toBeTruthy();
    for (const d of REVIEW_DOCS) expect(E[`job6.doc.${d}`]).toBeTruthy();
  });
});
