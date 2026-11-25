import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("editing published job posts", () => {
  const sql = read("supabase/migrations/20261125000005_admin_edit_published_job_posts.sql");
  const down = read("supabase/rollback/20261125000005_admin_edit_published_job_posts.down.sql");
  it("full admins may edit any post; moderators still cannot; owner never changes; rollback restores the draft-only rule", () => {
    expect(sql).toMatch(/and not public\.is_full_admin\(\) then\s+raise exception 'Moderators can only change the status of a post'/);
    expect(sql).toMatch(/Cannot change the owner of a post/);
    expect(sql).not.toMatch(/drop table|delete from|truncate|drop trigger/i);
    expect(down).toMatch(/old\.status = 'hidden' and public\.is_full_admin\(\)/);
  });
  it("owners edit only their own post, and the update is limited to their rows", () => {
    const a = read("app/actions/jobs.ts");
    const fn = a.slice(a.indexOf("export async function updateMyJobPost"));
    expect(fn).toMatch(/if \(!post \|\| post\.owner_id !== userId\) return \{ error: "forbidden"/);
    expect(fn).toMatch(/\.eq\("id", id\)\s*\.eq\("owner_id", userId\)/);
    expect(fn).not.toMatch(/owner_id: /); // never sets the owner
    expect(fn).not.toMatch(/job_applications/); // applications untouched
    const page = read("app/jobs/employer/[id]/edit/page.tsx");
    expect(page).toMatch(/if \(!post \|\| post\.owner_id !== me\) notFound\(\)/);
  });
  it("admins can edit published posts too (no draft-only check left)", () => {
    const a = read("app/actions/jobs.ts");
    expect(a).not.toMatch(/error: "not_draft"/);
    expect(read("app/admin/jobs.tsx")).toMatch(/canEdit && p\.status !== "removed" && \(/);
  });
  it("Edit buttons appear for owners on the dashboard, applicants page and job page, with 44px targets", () => {
    expect(read("app/jobs/employer/page.tsx")).toMatch(/href=\{`\/jobs\/employer\/\$\{p\.id\}\/edit`\} className="inline-flex min-h-11/);
    expect(read("app/jobs/employer/[id]/page.tsx")).toMatch(/\/jobs\/employer\/\$\{post\.id\}\/edit/);
    expect(read("app/jobs/[id]/page.tsx")).toMatch(/\/jobs\/employer\/\$\{job\.id\}\/edit/);
  });
  it("new strings exist in English and Filipino", () => {
    for (const k of Object.keys(en).filter((k) => k.startsWith("job.edit."))) expect((fil as Record<string, string>)[k], k).toBeTruthy();
    expect((en as Record<string, string>)["job.edit.button"]).toBe("Edit post");
  });
});
