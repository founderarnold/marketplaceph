import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_PLACEHOLDER, EMPLOYMENT_TYPES, JOB_CATEGORIES, WORK_SETUPS, hasAdminPlaceholder } from "@/lib/jobs";
import { EMPLOYERS, JOBS, NO_FEE_NOTICE, PARTNER_NOTICE, PLACEHOLDER, descriptionOf, qualificationsOf } from "../scripts/starter-jobs.mjs";

type Job = { key: string; employer: string; title: string; category: string; employment_type: string; work_setup: string; partner?: boolean; realEstate?: boolean };
const jobs = JOBS as Job[];
const textOf = (j: Job) => `${j.title}\n${descriptionOf(j)}\n${qualificationsOf(j)}`;

/** Same patterns as the job_posts_guard() trigger, which rejects posts that ask for fees. */
const DB_FEE_GUARD = [/(placement|processing|training|registration|medical|application|deployment)\s+fee/, /(pay|deposit|send)\s+(first|upfront|up-front|before)/, /bayad\s+(muna|una)/];

describe("starter job posts", () => {
  it("covers every requested role, once", () => {
    const wanted = ["sales staff", "marketing associate", "rider", "delivery driver", "field marketing assistant", "affiliate marketer", "dropshipper",
      "it staff", "web developer", "mobile app developer", "marketing supervisor", "marketing manager", "real estate salesperson", "real estate broker",
      "real estate manager", "real estate agent", "management trainee", "baker", "assistant baker"];
    expect(jobs).toHaveLength(wanted.length);
    for (const w of wanted) expect(jobs.some((j) => j.title.toLowerCase().includes(w)), w).toBe(true);
    expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
  });

  it("uses only valid categories, types, setups and known employers", () => {
    for (const j of jobs) {
      expect(JOB_CATEGORIES).toContain(j.category);
      expect(EMPLOYMENT_TYPES).toContain(j.employment_type);
      expect(WORK_SETUPS).toContain(j.work_setup);
      expect(Object.keys(EMPLOYERS)).toContain(j.employer);
      expect(descriptionOf(j).length).toBeLessThanOrEqual(5000);
      expect(qualificationsOf(j).length).toBeLessThanOrEqual(3000);
    }
    expect(new Set(jobs.map((j) => j.employer)).size).toBe(4);
  });

  it("every post carries the no-fee notice and passes the database fee guard", () => {
    for (const j of jobs) {
      expect(descriptionOf(j)).toContain(NO_FEE_NOTICE);
      for (const re of DB_FEE_GUARD) expect(textOf(j).toLowerCase()).not.toMatch(re);
    }
  });

  it("has no age, gender, civil status or appearance requirements", () => {
    const banned = /\b(male|female|gender|years old|age \d|aged|single|married|height|weight|pleasing personality|good-looking|physically attractive|presentable)\b/i;
    for (const j of jobs) expect(textOf(j), j.key).not.toMatch(banned);
  });

  it("labels affiliate and dropshipper roles as commission-based partners, never salaried employment", () => {
    for (const key of ["mph-affiliate-marketer", "mph-dropshipper"]) {
      const j = jobs.find((x) => x.key === key)!;
      expect(j.partner).toBe(true);
      expect(j.employment_type).toBe("freelance");
      expect(j.title).toMatch(/Commission-Based Partner/);
      expect(descriptionOf(j).startsWith(PARTNER_NOTICE)).toBe(true);
      expect(PARTNER_NOTICE).toMatch(/NOT salaried employment/);
      expect(PARTNER_NOTICE).toMatch(/No fees/);
    }
  });

  it("real estate roles mention PRC licensing or accreditation under RA 9646", () => {
    const re = jobs.filter((j) => /real estate/i.test(j.title));
    expect(re).toHaveLength(4);
    for (const j of re) {
      expect(j.realEstate).toBe(true);
      expect(textOf(j)).toMatch(/RA 9646/);
      expect(textOf(j)).toMatch(/PRC/);
    }
  });

  it("pay and location are clear placeholders that block publishing until an admin fills them", () => {
    expect(PLACEHOLDER).toBe(ADMIN_PLACEHOLDER);
    for (const j of jobs) {
      expect(descriptionOf(j)).toMatch(/Location: \[ADMIN TO FILL/);
      expect(descriptionOf(j)).toMatch(j.partner ? /Earnings: \[ADMIN TO FILL/ : /Pay range: \[ADMIN TO FILL/);
      expect(hasAdminPlaceholder(j.title, descriptionOf(j))).toBe(true);
    }
    expect(hasAdminPlaceholder("Baker", "Pay: ₱18,000 – ₱20,000 / month", null)).toBe(false);
  });

  it("the SQL seed is up to date, inserts hidden drafts only, and never updates or deletes", () => {
    const sql = readFileSync(new URL("../supabase/seeds/jobs_starter_posts.sql", import.meta.url), "utf8");
    for (const j of jobs) expect(sql).toContain(`'${j.title.replaceAll("'", "''")}'`);
    expect(sql).toMatch(/j\.vacancies, 'hidden'\s*\nfrom starter_jobs/);
    expect(sql).toMatch(/and not exists \(select 1 from public\.job_posts p where p\.owner_id = e\.owner_id and p\.title = j\.title/);
    expect(sql).not.toMatch(/\b(update|delete from|truncate|drop table)\s+public\./i);
  });
});

describe("admin draft editing migration", () => {
  const up = readFileSync(new URL("../supabase/migrations/20261125000001_admin_edit_draft_job_posts.sql", import.meta.url), "utf8");
  const down = readFileSync(new URL("../supabase/rollback/20261125000001_admin_edit_draft_job_posts.down.sql", import.meta.url), "utf8");
  it("only full admins, only hidden posts, owner never changes, changes are audited", () => {
    expect(up).toMatch(/old\.status = 'hidden' and public\.is_full_admin\(\)/);
    expect(up).toMatch(/Cannot change the owner of a post/);
    expect(up).toMatch(/create trigger audit_job_posts after update on public\.job_posts/);
    expect(up).not.toMatch(/\b(drop table|drop column|alter table .* drop|delete from|truncate)\b/i);
  });
  it("has a rollback that restores the original rule", () => {
    expect(down).toMatch(/drop trigger if exists audit_job_posts/);
    expect(down).not.toMatch(/is_full_admin/);
  });
});
