import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HIRING_TAGS, JOB_IMAGE_PATH } from "@/lib/jobs";
import { JOB_TEMPLATES } from "@/lib/job-templates";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const E = en as Record<string, string>;
const F = fil as Record<string, string>;

describe("posting tools", () => {
  const sql = read("supabase/migrations/20261125000006_jobs_posting_tools.sql");
  it("migration is additive, tags match the app, images use the public bucket path format, saved jobs are private", () => {
    for (const k of HIRING_TAGS) expect(sql).toContain(`'${k}'`);
    expect(sql).not.toMatch(/drop (table|column)|delete from|truncate/i);
    expect(sql).toMatch(/create policy saved_jobs_read on public\.saved_jobs for select using \(user_id = auth\.uid\(\)\)/);
    expect(JOB_IMAGE_PATH.test("1b0c1f6e-1111-4222-8333-944455556666/2b0c1f6e-1111-4222-8333-944455556666.webp")).toBe(true);
    expect(JOB_IMAGE_PATH.test("../job-documents/x.pdf")).toBe(false);
    expect(read("components/jobs2/posting-tools.tsx")).not.toMatch(/job-documents/);
  });
  it("duplicate makes a hidden draft with the same owner, never copies applications, and logs admin copies", () => {
    const a = read("app/actions/jobs.ts");
    const fn = a.slice(a.indexOf("export async function duplicateJobPost"), a.indexOf("export async function markJobFilled"));
    expect(fn).toMatch(/status: "hidden" as const/);
    expect(fn).toMatch(/owner_id, status: "hidden"/);
    expect(fn).not.toMatch(/job_applications/);
    expect(fn).toMatch(/const admin = await requireFullAdmin/);
    expect(fn).toMatch(/action: "DUPLICATE"/);
    expect(fn).toMatch(/filter\(\(x\) => x !== "filled"\)/);
  });
  it("'Hired / filled' closes the post", () => {
    const a = read("app/actions/jobs.ts");
    expect(a).toMatch(/update\(\{ hiring_tags: tags, status: "closed" \}\)/);
  });
  it("templates cover the 19 roles with no admin placeholders", () => {
    expect(JOB_TEMPLATES).toHaveLength(19);
    for (const tpl of JOB_TEMPLATES) expect(tpl.description).not.toContain("[ADMIN TO FILL");
  });
  it("buttons and strings exist in both languages", () => {
    for (const k of HIRING_TAGS) { expect(E[`job.tag.${k}`]).toBeTruthy(); expect(F[`job.tag.${k}`]).toBeTruthy(); }
    for (const k of Object.keys(E).filter((k) => k.startsWith("job.tools."))) expect(F[k], k).toBeTruthy();
    expect(read("app/admin/jobs.tsx")).toMatch(/<DuplicateButton id=\{p\.id\} admin \/>/);
    expect(read("app/jobs/employer/page.tsx")).toMatch(/<DuplicateButton id=\{p\.id\} \/>/);
    expect(read("app/jobs/[id]/page.tsx")).toMatch(/<DuplicateButton id=\{job\.id\} \/>/);
  });
});
