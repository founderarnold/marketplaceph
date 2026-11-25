/**
 * Readable job links, Commission-Based jobs and the Verified Professional Account badge (20261125000009).
 * Pure checks: the app's lists match the database rules, and every new label exists in English and Filipino.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPLOYMENT_TYPES, JOB_SLUG, jobPath } from "@/lib/jobs";
import { proChecklist } from "@/lib/jobs-verify";
import { REMOVABLE_BADGES } from "@/lib/social";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const sql = readFileSync(new URL("../supabase/migrations/20261125000009_jobs_links_verified_pros.sql", import.meta.url), "utf8");
const E = en as Record<string, string>;
const F = fil as Record<string, string>;

describe("Commission-Based job type", () => {
  it("the database allows exactly the app's job types, and both languages have a label", () => {
    const m = sql.match(/employment_type in \(([^)]+)\)/)!;
    const db = m[1].split(",").map((x) => x.trim().replace(/'/g, ""));
    expect(new Set(db)).toEqual(new Set(EMPLOYMENT_TYPES));
    expect(EMPLOYMENT_TYPES).toContain("commission");
    for (const ty of EMPLOYMENT_TYPES) { expect(E[`job.type.${ty}`]).toBeTruthy(); expect(F[`job.type.${ty}`]).toBeTruthy(); }
    expect(E["job.type.commission"]).toBe("Commission-Based");
  });
});

describe("readable job links", () => {
  it("uses the slug when there is one, the id otherwise", () => {
    expect(jobPath({ id: "2279254c-dab9-48f7-b3db-e5f491b9dc8c", slug: "marketing-manager-san-fernando-pampanga" })).toBe("/jobs/marketing-manager-san-fernando-pampanga");
    expect(jobPath({ id: "2279254c-dab9-48f7-b3db-e5f491b9dc8c", slug: null })).toBe("/jobs/2279254c-dab9-48f7-b3db-e5f491b9dc8c");
  });
  it("accepts only lowercase words joined by dashes", () => {
    expect(JOB_SLUG.test("marketing-manager-san-fernando-pampanga")).toBe(true);
    for (const bad of ["Marketing", "a--b", "-a", "a-", "a b", "../x", "a_b"]) expect(JOB_SLUG.test(bad)).toBe(false);
  });
  it("the copied and Messenger links carry no tracking tags", () => {
    const src = readFileSync(new URL("../components/jobs2/posting-tools.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/writeText\(url\)/);
    expect(src).toMatch(/fb-messenger:\/\/share\/\?link=\$\{encodeURIComponent\(url\)\}/);
  });
  it("the slug is kept by the database, not typed by people, and old slugs keep working", () => {
    expect(sql).toMatch(/new\.slug := old\.slug/);
    expect(sql).toMatch(/old_slugs/);
    expect(sql).toMatch(/alter table public\.job_posts enable trigger user/);
  });
});

describe("Verified Professional Account", () => {
  it("documents checklist: profile, resume, ID photo and one clearance", () => {
    const docs = [{ kind: "resume" }, { kind: "photo_half_body" }, { kind: "barangay_clearance" }];
    expect(proChecklist({ consent_at: "2026-11-25" }, docs).complete).toBe(true);
    expect(proChecklist(null, docs).complete).toBe(false);
    expect(proChecklist({ consent_at: "x" }, docs.slice(0, 2)).items.find((i) => i.key === "clearance")!.ok).toBe(false);
    expect(proChecklist({ consent_at: "x" }, [{ kind: "nbi_clearance" }, { kind: "photo_2x2" }]).items.find((i) => i.key === "resume")!.ok).toBe(false);
  });
  it("the database checks the same documents and needs a passed interview before granting", () => {
    expect(sql).toMatch(/kind = 'resume'/);
    expect(sql).toMatch(/kind in \('photo_2x2', 'photo_half_body'\)/);
    expect(sql).toMatch(/kind in \('nbi_clearance', 'police_clearance', 'barangay_clearance'\)/);
    expect(sql).toMatch(/result = 'passed'/);
    expect(sql).toMatch(/alter table public\.pro_verification_interviews enable row level security/);
    expect(sql).not.toMatch(/drop table|drop column|delete from|truncate/i);
    expect(REMOVABLE_BADGES).toContain("verified_professional");
  });
  it("every new label exists in English and Filipino", () => {
    const keys = Object.keys(E).filter((k) => /^(pro\.|sendp\.|job\.share\.)/.test(k) || k.startsWith("badge.verified_professional"));
    expect(keys.length).toBeGreaterThan(50);
    for (const k of keys) expect(F[k], k).toBeTruthy();
    expect(E["job.apply.submit"]).toBe("Send My Profile to Apply");
    expect(E["pro.request"]).toBe("Submit Request for Account Verification");
  });
});
