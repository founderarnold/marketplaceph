import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_PLACEHOLDER, PUBLISH_DEFAULTS, cleanAdminPlaceholders, hasAdminPlaceholder } from "@/lib/jobs";
import { JOBS, NO_FEE_NOTICE, PARTNER_NOTICE, RA9646_NOTICE, descriptionOf, qualificationsOf } from "../scripts/starter-jobs.mjs";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

type Job = { key: string; partner?: boolean; realEstate?: boolean };
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("publishing drafts with blank details", () => {
  it("replaces every placeholder with clean wording for all 19 starter posts", () => {
    for (const j of JOBS as Job[]) {
      const d = cleanAdminPlaceholders(descriptionOf(j))!;
      expect(d, j.key).not.toContain(ADMIN_PLACEHOLDER);
      expect(d).not.toMatch(/\[|\]/);
      expect(d).toContain(PUBLISH_DEFAULTS.location);
      expect(d).toContain(j.partner ? PUBLISH_DEFAULTS.commission : PUBLISH_DEFAULTS.pay);
      // Safety wording is kept.
      expect(d).toContain(NO_FEE_NOTICE);
      if (j.partner) expect(d.startsWith(PARTNER_NOTICE)).toBe(true);
      if (j.realEstate) expect(d).toContain(RA9646_NOTICE);
      expect(hasAdminPlaceholder(d, cleanAdminPlaceholders(qualificationsOf(j)))).toBe(false);
      expect(d.length).toBeGreaterThanOrEqual(20);
    }
  });
  it("leaves finished text alone and removes stray notes cleanly", () => {
    expect(cleanAdminPlaceholders("Pay: ₱18,000 / month")).toBe("Pay: ₱18,000 / month");
    expect(cleanAdminPlaceholders(null)).toBeNull();
    expect(cleanAdminPlaceholders("Intro\nShift: [ADMIN TO FILL: hours]\nEnd")).toBe("Intro\nEnd");
    expect(cleanAdminPlaceholders("Baker [ADMIN TO FILL: branch]")).toBe("Baker");
  });
  it("publishing never blocks on placeholders; publish-all only touches starter drafts", () => {
    const action = read("app/actions/jobs.ts");
    expect(action).not.toMatch(/error: "placeholder"/);
    expect(action).toMatch(/\.eq\("status", "hidden"\)\.like\("description", "%\[ADMIN TO FILL%"\)/);
    // Clean-up happens while still hidden (the database only allows admin wording changes then), then status changes.
    const fn = action.slice(action.indexOf("async function publishOne"));
    expect(fn.indexOf("cleanAdminPlaceholders")).toBeLessThan(fn.indexOf('status: "active"'));
  });
  it("new admin strings exist in English and Filipino", () => {
    for (const k of ["job.admin.publish_all", "job.admin.confirm_publish_all", "job.admin.published_all", "job.admin.published_some", "job.admin.has_placeholder"]) {
      expect((en as Record<string, string>)[k], k).toBeTruthy();
      expect((fil as Record<string, string>)[k], k).toBeTruthy();
    }
    expect((en as Record<string, string>)["job.admin.has_placeholder"]).toMatch(/still publish/);
  });
});
