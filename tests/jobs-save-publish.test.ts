import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("Save & Publish on the job post edit form", () => {
  it("the form has a second submit button that sends intent=publish, after Save", () => {
    const form = read("components/jobs/admin-post-form.tsx");
    expect(form).toMatch(/name="intent" value="publish"/);
    expect(form.indexOf('t("common.save")')).toBeLessThan(form.indexOf('t("job.edit.save_publish")'));
  });
  it("both save actions publish only after a successful save", () => {
    const action = read("app/actions/jobs.ts");
    for (const name of ["adminUpdateJobPost", "updateMyJobPost"]) {
      const fn = action.slice(action.indexOf(`export async function ${name}`));
      const body = fn.slice(0, fn.indexOf("\n}\n"));
      expect(body, name).toMatch(/fd\.get\("intent"\) === "publish"/);
      expect(body.indexOf("if (error) return"), name).toBeLessThan(body.indexOf('fd.get("intent")'));
    }
    // Admins publish through the same path as the Publish button (placeholder clean-up included).
    const admin = action.slice(action.indexOf("export async function adminUpdateJobPost"));
    expect(admin.slice(0, admin.indexOf("\n}\n"))).toMatch(/publishOne\(ctx\.supabase, id\)/);
  });
});

describe("Admin → Jobs shows where each job is", () => {
  it("loads city, province and region names with the posts", () => {
    const page = read("app/admin/jobs.tsx");
    expect(page).toMatch(/province:psgc_provinces\(name\), city:psgc_cities\(name\)/);
  });
});

it("new strings exist in English and Filipino", () => {
  for (const k of ["job.edit.save_publish", "job.edit.saved_published", "job.edit.publish_failed", "job.admin.no_location"]) {
    expect((en as Record<string, string>)[k], k).toBeTruthy();
    expect((fil as Record<string, string>)[k], k).toBeTruthy();
  }
  expect((en as Record<string, string>)["job.edit.save_publish"]).toBe("Save & Publish");
});
