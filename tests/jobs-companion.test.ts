/**
 * Jobs applicant companion: kind-of-work filters, Apply Now basics, Follow-up, Re-Apply and the step guide.
 * Pure-logic tests always run; database tests run against the LOCAL Supabase stack with seed data.
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { HIRING_TAGS, JOB_KIND_CONDITION, JOB_KIND_FILTERS, parseKinds } from "@/lib/jobs";
import { applicationGuide, followUpFrom, reapplyState } from "@/lib/jobs-companion";
import en from "@/messages/en.json";
import fil from "@/messages/fil.json";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const E = en as Record<string, string>;
const F = fil as Record<string, string>;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

describe("kind-of-work filters", () => {
  it("parses only known kinds, and each maps to a filter on posts", () => {
    expect(parseKinds(["wfh", "bogus", "on_call", "wfh"])).toEqual(["wfh", "on_call"]);
    expect(parseKinds("part_time")).toEqual(["part_time"]);
    expect(parseKinds(undefined)).toEqual([]);
    expect(JOB_KIND_CONDITION.wfh).toBe("work_setup.eq.remote");
    expect(JOB_KIND_CONDITION.part_time).toBe("employment_type.eq.part_time");
    expect(JOB_KIND_CONDITION.on_call).toBe("hiring_tags.cs.{on_call}");
    expect(HIRING_TAGS).toContain("on_call");
  });
  it("the migration allows exactly the app's tag list", () => {
    const sql = read("supabase/migrations/20261125000008_jobs_applicant_companion.sql");
    const m = sql.match(/hiring_tags <@ array\[([^\]]+)\]/)!;
    const dbTags = m[1].split(",").map((x) => x.trim().replace(/'/g, ""));
    expect(new Set(dbTags)).toEqual(new Set(HIRING_TAGS));
    expect(sql).not.toMatch(/drop (table|column)|delete from|truncate/i);
    expect(sql).toMatch(/revoke all on function public\.reapply_to_job\(uuid, text\) from public, anon/);
  });
});

describe("follow-up and re-apply rules", () => {
  const base = { status: "submitted", created_at: ago(1), updated_at: ago(1) };
  it("follow-up opens 3 days after applying and after your own last message; never when closed out", () => {
    const f = followUpFrom(base, null)!;
    expect(Math.round((f.getTime() - new Date(base.created_at).getTime()) / DAY)).toBe(3);
    const later = followUpFrom({ ...base, created_at: ago(10) }, ago(1))!;
    expect(later.getTime()).toBeGreaterThan(Date.now());
    expect(followUpFrom({ ...base, created_at: ago(10) }, ago(5))!.getTime()).toBeLessThan(Date.now());
    for (const s of ["withdrawn", "rejected", "hired"]) expect(followUpFrom({ ...base, status: s }, null)).toBeNull();
  });
  it("re-apply: withdrawn now, not selected after 14 days, once a week, max 3, only while open", () => {
    expect(reapplyState({ ...base, status: "withdrawn" }, true)).toEqual({ ok: true });
    expect(reapplyState({ ...base, status: "submitted" }, true)).toMatchObject({ ok: false });
    expect(reapplyState({ ...base, status: "withdrawn" }, false)).toMatchObject({ ok: false, reason: "closed" });
    const r = reapplyState({ ...base, status: "rejected", updated_at: ago(2) }, true);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.from!.getTime()).toBeGreaterThan(Date.now());
    expect(reapplyState({ ...base, status: "rejected", updated_at: ago(15) }, true)).toEqual({ ok: true });
    expect(reapplyState({ ...base, status: "withdrawn", reapplied_at: ago(2), reapply_count: 1 }, true)).toMatchObject({ ok: false });
    expect(reapplyState({ ...base, status: "withdrawn", reapply_count: 3 }, true)).toMatchObject({ ok: false, reason: "max" });
  });
  it("the step guide marks done steps and exactly one 'do now' step after the profile tip", () => {
    const g = applicationGuide(base, { hasResume: true, followedUp: false });
    expect(g.map((s) => s.key)).toEqual(["profile", "sent", "follow", "review", "interview", "result"]);
    expect(g.filter((s) => s.state === "now").map((s) => s.key)).toEqual(["follow"]);
    const i = applicationGuide({ ...base, status: "interview" }, { hasResume: false, followedUp: true });
    expect(i.find((s) => s.key === "profile")!.state).toBe("now");
    expect(i.find((s) => s.key === "interview")!.state).toBe("now");
    expect(i.find((s) => s.key === "result")!.state).toBe("todo");
    const w = applicationGuide({ ...base, status: "withdrawn" }, { hasResume: true, followedUp: false });
    expect(w.find((s) => s.key === "sent")!.state).toBe("now");
  });
});

describe("wording", () => {
  it("every new string exists in English and Filipino with the same placeholders", () => {
    const keys = Object.keys(E).filter((k) => k.startsWith("comp.")).concat(["job.tag.on_call", "sys.job.reapplied"]);
    expect(keys.length).toBeGreaterThan(80);
    for (const k of keys) {
      expect(F[k], k).toBeTruthy();
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(F[k]), k).toBe(ph(E[k]));
    }
    for (const k of JOB_KIND_FILTERS) expect(E[`comp.kind.${k}`]).toBeTruthy();
    for (const b of ["apply", "profile", "save", "follow", "reapply", "share", "messages"]) expect(E[`comp.tips.btn_${b}`]).toBeTruthy();
  });
  it("Apply Now basics never ask for birthdate, sex, civil status or street address", () => {
    const a = read("app/actions/jobs-companion.ts");
    const schema = a.slice(a.indexOf("const basicSchema"), a.indexOf("});", a.indexOf("const basicSchema")));
    for (const f of ["birthdate", "sex", "civil_status", "address_note"]) expect(schema).not.toContain(f);
    expect(read("components/jobs/quick-apply.tsx")).not.toMatch(/birthdate|civil_status|address_note|name="sex"/);
  });
});

/* ───────── Database ───────── */
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { seeker: U(2), seller1: U(3), seller2: U(4) };
const anon = (): SupabaseClient => createClient(SB_URL, ANON, { auth: { persistSession: false } });
const svc = (): SupabaseClient => createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
async function as(email: string) {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}
let reachable = false;
beforeAll(async () => {
  try { reachable = (await fetch(`${SB_URL}/rest/v1/`, { headers: { apikey: ANON } })).ok && !!ANON && !!SERVICE; } catch { reachable = false; }
});
const guarded = (name: string, fn: () => Promise<void>) => it(name, async (ctx) => { if (!reachable) return ctx.skip(); await fn(); });
const posts: string[] = [];
afterEach(async () => {
  if (!reachable) return;
  const db = svc();
  if (posts.length) { await db.from("job_applications").delete().in("post_id", posts); await db.from("job_posts").delete().in("id", posts.splice(0)); }
});
async function post(extra: Record<string, unknown> = {}) {
  const employer = await as("seller2@marketplaceph.test");
  const { data, error } = await employer.from("job_posts").insert({
    owner_id: ids.seller2, poster_type: "employer", company_name: "Test Co", title: "Companion Test Job", category: "retail",
    description: "Handle the cash register and assist customers in our store.", employment_type: "full_time", work_setup: "onsite", ...extra,
  }).select("id").single();
  if (error) throw new Error(error.message);
  posts.push(data.id);
  return { employer, id: data.id as string };
}

describe("database: on-call tag and kind filters", () => {
  guarded("employers can tag a post On-call, and the filter finds it together with any other ticked kind", async () => {
    const a = await post({ hiring_tags: ["on_call"] });
    const b = await post({ work_setup: "remote" });
    const c = await post({});
    const { data } = await anon().from("job_posts").select("id").in("id", [a.id, b.id, c.id])
      .or([JOB_KIND_CONDITION.on_call, JOB_KIND_CONDITION.wfh].join(","));
    expect(new Set((data ?? []).map((r) => r.id))).toEqual(new Set([a.id, b.id]));
    const bad = await a.employer.from("job_posts").update({ hiring_tags: ["nope"] }).eq("id", a.id);
    expect(bad.error).not.toBeNull();
  });
});

describe("database: re-apply and follow-up", () => {
  guarded("withdrawn -> re-apply works once a week, posts an applicant update card, and only the applicant can do it", async () => {
    const { employer, id } = await post();
    const seeker = await as("buyer@marketplaceph.test");
    const { data: appId, error } = await seeker.rpc("apply_to_job", { p_post: id, p_note: "Hello", p_docs: [] });
    expect(error).toBeNull();
    // Not yet withdrawn: re-apply refused.
    expect((await seeker.rpc("reapply_to_job", { p_app: appId, p_note: null })).error?.message).toMatch(/withdrawn or not-selected/);
    expect((await seeker.rpc("withdraw_application", { p_app: appId })).error).toBeNull();
    // A stranger and the employer cannot re-apply it; anonymous visitors cannot call it at all.
    expect((await (await as("seller1@marketplaceph.test")).rpc("reapply_to_job", { p_app: appId })).error).not.toBeNull();
    expect((await employer.rpc("reapply_to_job", { p_app: appId })).error).not.toBeNull();
    expect((await anon().rpc("reapply_to_job", { p_app: appId })).error).not.toBeNull();
    expect((await seeker.rpc("reapply_to_job", { p_app: appId, p_note: "I now have my NBI clearance." })).error).toBeNull();
    const { data: app } = await svc().from("job_applications").select("status, reapply_count, note").eq("id", appId).single();
    expect(app).toMatchObject({ status: "submitted", reapply_count: 1, note: "I now have my NBI clearance." });
    const { data: card } = await svc().from("job_messages").select("sender_id, system_kind, job_threads!inner(application_id)").eq("job_threads.application_id", appId).eq("system_kind", "job.reapplied");
    expect(card?.[0]?.sender_id).toBe(ids.seeker);
    // Within a week: refused.
    await seeker.rpc("withdraw_application", { p_app: appId });
    expect((await seeker.rpc("reapply_to_job", { p_app: appId })).error?.message).toMatch(/once a week/);
  });

  guarded("not selected: re-apply only after 14 days", async () => {
    const { employer, id } = await post();
    const seeker = await as("buyer@marketplaceph.test");
    const { data: appId } = await seeker.rpc("apply_to_job", { p_post: id, p_note: null, p_docs: [] });
    expect((await employer.rpc("set_application_status", { p_app: appId, p_status: "rejected", p_note: null })).error).toBeNull();
    expect((await seeker.rpc("reapply_to_job", { p_app: appId })).error?.message).toMatch(/14 days/);
  });

  guarded("the applicant can send a follow-up message in the application's chat; the employer sees it, a stranger does not", async () => {
    const { employer, id } = await post();
    const seeker = await as("buyer@marketplaceph.test");
    const { data: appId } = await seeker.rpc("apply_to_job", { p_post: id, p_note: null, p_docs: [] });
    const { data: tid } = await seeker.rpc("open_job_thread", { p_app: appId });
    expect((await seeker.from("job_messages").insert({ thread_id: tid, sender_id: ids.seeker, body: "Good day! Any update on my application?" })).error).toBeNull();
    expect((await employer.from("job_messages").select("body").eq("thread_id", tid).eq("is_system", false)).data?.[0]?.body).toMatch(/Any update/);
    expect((await (await as("seller1@marketplaceph.test")).from("job_messages").select("body").eq("thread_id", tid)).data).toEqual([]);
  });

  guarded("saving only the basic details keeps the rest of an existing profile", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const { data: before } = await svc().from("job_profiles").select("*").eq("user_id", ids.seeker).single();
    const { error } = await seeker.from("job_profiles").upsert({ user_id: ids.seeker, full_name: before.full_name, phone: "09171234567", desired_roles: "Cashier" });
    expect(error).toBeNull();
    const { data: after } = await svc().from("job_profiles").select("*").eq("user_id", ids.seeker).single();
    expect(after.skills).toEqual(before.skills);
    expect(after.work_history).toEqual(before.work_history);
    expect(after.consent_at).toEqual(before.consent_at);
    await svc().from("job_profiles").update({ phone: before.phone, desired_roles: before.desired_roles }).eq("user_id", ids.seeker);
  });
});

describe("Save & Publish and admin job locations", () => {
  it("both edit forms post a 'publish' flag; admin publish reuses publishOne; owner publish stays limited to the owner", () => {
    expect(read("components/jobs/admin-post-form.tsx")).toMatch(/name="publish" value="1"/);
    const a = read("app/actions/jobs.ts");
    const admin = a.slice(a.indexOf("export async function adminUpdateJobPost"), a.indexOf("export async function adminSetJobPostStatus"));
    expect(admin).toMatch(/publishOne\(ctx\.supabase, id\)/);
    expect(admin).toMatch(/!extras\.hiring_tags\.includes\("filled"\)/);
    const owner = a.slice(a.indexOf("export async function updateMyJobPost"));
    expect(owner).toMatch(/update\(\{ status: "active" \}\)\.eq\("id", id\)\.eq\("owner_id", userId\)/);
    expect(E["job.edit.save_publish"]).toBe("Save & Publish");
    expect(F["job.edit.save_publish"]).toBeTruthy();
  });
  it("Admin > Jobs shows city and province (or region) for each post", () => {
    const j = read("app/admin/jobs.tsx");
    expect(j).toMatch(/psgc_cities \( name \), psgc_provinces \( name \)/);
    expect(E["job.admin.no_location"]).toBeTruthy();
    expect(F["job.admin.no_location"]).toBeTruthy();
  });
});
