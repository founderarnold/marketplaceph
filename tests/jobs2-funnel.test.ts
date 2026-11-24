import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JOB_EVENTS } from "@/lib/jobs-events";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("P7 funnel events", () => {
  const sql = read("supabase/migrations/20261125000004_jobs2_funnel_events.sql");
  it("every event the app can send is allowed by the database (constraint and function)", () => {
    const fn = sql.slice(sql.indexOf("create or replace function public.record_job_event"));
    for (const e of JOB_EVENTS) {
      expect(sql.slice(0, sql.indexOf("create or replace function")), e).toContain(`'${e}'`);
      expect(fn, e).toContain(`'${e}'`);
    }
  });
  it("covers every funnel step named in the plan", () => {
    for (const e of ["jobs_landing_view", "job_search", "job_view", "signup_start", "signup_complete", "flame_link_result", "profile_step_complete",
      "profile_ready", "resume_generated", "apply_start", "apply_submitted", "employer_viewed", "status_changed", "interview", "hire_recorded",
      "hire_confirmed", "review_submitted"]) expect(JOB_EVENTS as readonly string[]).toContain(e);
  });
  it("the daily view is admin-only through RLS and retention never goes below 30 days", () => {
    expect(sql).toMatch(/create or replace view public\.job_funnel_daily with \(security_invoker = true\)/);
    expect(sql).toMatch(/greatest\(p_days, 30\)/);
  });
  it("server-side events never send notes, ratings or comments", () => {
    const jobs = read("app/actions/jobs.ts");
    const social = read("app/actions/social.ts");
    for (const src of [jobs, social]) for (const m of src.matchAll(/recordJobEvent\("[a-z_]+", (\{[^}]*\})\)/g)) expect(m[1]).not.toMatch(/note|rating|comment/);
  });
  it("funnel page labels exist in both languages", () => {
    for (const k of Object.keys(en).filter((k) => k.startsWith("job7."))) expect((fil as Record<string, string>)[k], k).toBeTruthy();
  });
  it("the pilot runbook covers owners, ramp, stop conditions and rollback", () => {
    const rb = read("docs/JOBS_2_PILOT_RUNBOOK.md");
    for (const h of ["Owners and support", "Go / no-go", "Campaign ramp", "stop conditions", "Rollback", "Not yet done"]) expect(rb).toContain(h);
    expect(rb).toMatch(/10%[\s\S]*30%[\s\S]*100%/);
  });
});
