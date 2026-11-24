import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchReasons, TIMELINE } from "@/lib/jobs-match";
import { APPLICATION_STATUSES } from "@/lib/jobs";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const E = en as Record<string, string>;
const F = fil as Record<string, string>;
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-25T00:00:00Z");
const job = {
  title: "Delivery Rider", description: "Deliver orders. Must know motorcycle maintenance.", qualifications: "Driving license",
  employment_type: "full_time", work_setup: "onsite", city_code: "C1", province_code: "P1", salary_min: 15000, salary_max: 18000,
  salary_period: "month", created_at: "2026-11-22T00:00:00Z", employer_verified: true,
};

describe("explainable matching (job-relevant only)", () => {
  it("gives human-readable reasons", () => {
    const r = matchReasons({ desired_roles: "rider, driver", skills: ["motorcycle", "driving", "cooking"], job_types: ["full_time"], city_code: "C1", expected_salary_min: 16000 }, job, NOW);
    expect(r.map((x) => x.key)).toEqual(["role", "skills", "type", "near_city", "pay", "fresh", "verified"]);
    expect(r.find((x) => x.key === "skills")).toEqual({ key: "skills", n: 2 });
    for (const x of r) expect(E[`job5.why.${x.key}`], x.key).toBeTruthy();
  });
  it("no profile means no reasons, and the matcher never reads sensitive fields", () => {
    expect(matchReasons(null, job, NOW)).toEqual([]);
    const code = read("lib/jobs-match.ts").split("*/").slice(1).join("*/");
    expect(code).not.toMatch(/birthdate|\.sex\b|civil_status|address_note/);
  });
  it("never hides or reorders jobs on the board", () => {
    const page = read("app/jobs/page.tsx");
    expect(page).toMatch(/Order and results never change/);
    expect(page).not.toMatch(/reasonsFor\([^)]*\)\.length\s*[><=]/);
    expect(page).not.toMatch(/\.filter\(\(j\) => reasonsFor/);
  });
});

describe("application review and timeline", () => {
  const review = read("components/jobs2/apply-review.tsx");
  it("locks while sending, needs final consent, and treats 'already applied' as done", () => {
    expect(review).toMatch(/if \(sending\.current \|\| !agree\) return;/);
    expect(review).toMatch(/disabled=\{pending \|\| !agree\}/);
    expect(review).toMatch(/already applied/);
  });
  it("records apply events without the note or document names", () => {
    for (const m of review.matchAll(/recordJobEvent\("([a-z_]+)", (\{[^}]*\})/g)) {
      expect(m[2]).not.toMatch(/note|title|kind|picked/);
    }
  });
  it("is behind jobs2_matching on the job page and the applications page", () => {
    expect(read("app/jobs/[id]/page.tsx")).toMatch(/const matching = isOn\("jobs2_matching"\)/);
    expect(read("app/jobs/applications/page.tsx")).toMatch(/const timeline = isOn\("jobs2_matching"\)/);
  });
  it("has a next step for every application status, in both languages", () => {
    for (const s of APPLICATION_STATUSES) { expect(E[`job5.next.${s}`], s).toBeTruthy(); expect(F[`job5.next.${s}`], s).toBeTruthy(); }
    expect([...TIMELINE]).toEqual(["submitted", "viewed", "shortlisted", "interview", "hired"]);
    for (const k of Object.keys(E).filter((k) => k.startsWith("job5."))) expect(F[k], k).toBeTruthy();
  });
});
