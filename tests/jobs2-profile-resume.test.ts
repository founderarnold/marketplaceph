import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("profile wizard (jobs2_profile_wizard)", () => {
  const action = read("app/actions/jobs2.ts");
  const wizard = read("components/jobs2/profile-wizard.tsx");
  it("is behind its flag on the page and in the save action", () => {
    expect(read("app/jobs/profile/wizard/page.tsx")).toMatch(/if \(!isOn\("jobs2_profile_wizard"\)\) notFound\(\)/);
    expect(action).toMatch(/if \(!isOn\("jobs2_profile_wizard"\)\) return \{ ok: false, error: "off" \}/);
  });
  it("never asks for or saves birthdate, sex, civil status or street address", () => {
    const steps = action.slice(action.indexOf("const STEP_SCHEMAS"), action.indexOf("export type WizardStep"));
    expect(steps).not.toMatch(/birthdate|\bsex\b|civil_status|address_note/);
    expect(wizard).not.toMatch(/birthdate|name="sex"|civil_status|address_note/);
  });
  it("requires confirming the profile is true on the summary step, and consent on the last step", () => {
    expect(action).toMatch(/4: z\.object\(\{ headline: opt\(100\), about: opt\(1500\), accurate: z\.literal\(true\) \}\)/);
    expect(action).toMatch(/5: z\.object\(\{ consent: z\.literal\(true\) \}\)/);
    expect(wizard).toMatch(/job4\.example_label/);
  });
  it("autosaves with a visible status and keeps typing on failure", () => {
    expect(wizard).toMatch(/setTimeout\(\(\) => \{ void save\(\); \}, 1200\)/);
    expect(wizard).toMatch(/role="status" aria-live="polite"/);
    expect(wizard).toMatch(/catch \{\s*setStatus\("error"\)/);
  });
  it("keeps the existing full form as a fallback", () => {
    expect(wizard).toMatch(/href="\/jobs\/profile\?full=1"/);
    expect(read("app/jobs/profile/page.tsx")).toMatch(/<JobProfileForm /);
  });
});

describe("resume builder (jobs2_resume_builder)", () => {
  const page = read("app/jobs/profile/resume/page.tsx");
  it("is behind its flag and reads no sensitive fields or documents", () => {
    expect(page).toMatch(/if \(!isOn\("jobs2_resume_builder"\)\) notFound\(\)/);
    const fields = page.match(/const RESUME_FIELDS = "([^"]+)"/)![1];
    expect(fields).not.toMatch(/birthdate|\bsex\b|civil_status|address_note/);
    expect(page).not.toMatch(/from\("job_documents"\)/);
  });
  it("prints only the resume (browser print / save as PDF, nothing uploaded)", () => {
    const btn = read("components/jobs2/print-button.tsx");
    expect(btn).toMatch(/document\.getElementById\(targetId\)/);
    expect(btn).toMatch(/src\.innerHTML/);
    expect(btn).toMatch(/contentWindow!\.print\(\)/);
    expect(read("components/jobs2/print-button.tsx")).toMatch(/window\.print\(\)/);
  });
});

describe("P4 copy", () => {
  it("every job4 string exists in Filipino, including all five lessons", () => {
    const E = en as Record<string, string>;
    const F = fil as Record<string, string>;
    for (const k of Object.keys(E).filter((k) => k.startsWith("job4."))) expect(F[k], k).toBeTruthy();
    for (let n = 1; n <= 5; n++) expect(E[`job4.lesson${n}.body`]).toBeTruthy();
    expect(E["job4.lesson5.body"]).toMatch(/never ask you to pay/);
  });
});
