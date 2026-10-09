/**
 * Jobs marketplace integration tests: privacy of seeker profiles and documents, application workflow,
 * anti-scam post guards and moderation. Runs against the LOCAL Supabase stack with seed data
 * (buyer = job seeker with a profile; seller2 / seller3 own demo job posts; seller1 is a stranger).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = { admin: U(1), seeker: U(2), seller1: U(3), seller2: U(4), seller3: U(5) };

type Client = SupabaseClient<Database>;
const anon = (): Client => createClient<Database>(URL, ANON, { auth: { persistSession: false } });
const svc = (): Client => createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
async function as(email: string): Promise<Client> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}

let reachable = false;
beforeAll(async () => {
  try {
    reachable = (await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } })).ok && !!ANON && !!SERVICE;
  } catch {
    reachable = false;
  }
});
const guarded = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!reachable) return ctx.skip();
    await fn();
  });

const basePost = {
  poster_type: "employer" as const, company_name: "Test Co", title: "Test Cashier", category: "retail", description: "Handle the cash register and assist customers in our store.",
  employment_type: "full_time", work_setup: "onsite",
};
const createdPosts: string[] = [];
const createdDocs: string[] = [];
afterEach(async () => {
  if (!reachable) return;
  const db = svc();
  await db.from("job_applications").delete().in("post_id", createdPosts);
  if (createdPosts.length) await db.from("job_posts").delete().in("id", createdPosts.splice(0));
  if (createdDocs.length) await db.from("job_documents").delete().in("id", createdDocs.splice(0));
  await db.from("job_applications").delete().eq("applicant_id", ids.seeker);
  await db.from("job_profiles").update({ consent_at: new Date().toISOString() }).eq("user_id", ids.seeker);
  await db.from("job_doc_access_logs").delete().eq("viewer_id", ids.seller2);
});

async function seedPost(owner: Client, ownerId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await owner.from("job_posts").insert({ ...basePost, owner_id: ownerId, ...extra } as never).select("id").single();
  if (error) throw new Error(error.message);
  createdPosts.push(data.id);
  return data.id;
}
async function addDoc(seeker: Client, kind: string, name: string) {
  const { data, error } = await seeker.from("job_documents").insert({ user_id: ids.seeker, kind, storage_path: `${ids.seeker}/${name}.pdf`, mime_type: "application/pdf", size_bytes: 1000 } as never).select("id").single();
  if (error) throw new Error(error.message);
  createdDocs.push(data.id);
  return data.id;
}

describe("real estate category and public job board", () => {
  guarded("the Real Estate & Properties category exists", async () => {
    const { data } = await anon().from("categories").select("name_en, icon").eq("slug", "real-estate").single();
    expect(data).toMatchObject({ name_en: "Real Estate & Properties", icon: "building-2" });
  });

  guarded("anyone can read open posts; expired and hidden posts are not public", async () => {
    const employer = await as("seller2@marketplaceph.test");
    const open = await seedPost(employer, ids.seller2, { title: "Open post" });
    const expired = await seedPost(employer, ids.seller2, { title: "Expired post", deadline: "2020-01-01" });
    const hidden = await seedPost(employer, ids.seller2, { title: "Hidden post", status: "hidden" });
    const seen = (await anon().from("job_posts").select("id")).data!.map((r) => r.id);
    expect(seen).toContain(open);
    expect(seen).not.toContain(expired);
    expect(seen).not.toContain(hidden);
    const mine = (await employer.from("job_posts").select("id")).data!.map((r) => r.id);
    expect(mine).toEqual(expect.arrayContaining([open, expired, hidden]));
  });
});

describe("anti-scam guards on job posts", () => {
  guarded("posts that ask for fees are rejected; agencies need a licence number", async () => {
    const e = await as("seller2@marketplaceph.test");
    for (const bad of ["Pay a placement fee of 2000 pesos to start.", "Training fee required before day one.", "Magbayad muna ng 500 para sa ID.", "Deposit first then we send you the schedule."]) {
      const r = await e.from("job_posts").insert({ ...basePost, owner_id: ids.seller2, description: bad + " Lots of work available." } as never).select("id").single();
      expect(r.error?.message, bad).toMatch(/cannot ask applicants to pay/i);
    }
    const noLicence = await e.from("job_posts").insert({ ...basePost, owner_id: ids.seller2, poster_type: "agency" } as never).select("id").single();
    expect(noLicence.error?.message).toMatch(/licence or registration number/i);
    const ok = await e.from("job_posts").insert({ ...basePost, owner_id: ids.seller2, poster_type: "agency", agency_license_no: "DOLE-XX-0001", for_client: true } as never).select("id").single();
    expect(ok.error).toBeNull();
    createdPosts.push(ok.data!.id);
    // others cannot post as someone else
    expect((await e.from("job_posts").insert({ ...basePost, owner_id: ids.seller3 } as never)).error).not.toBeNull();
  });

  guarded("an owner can always close an older post, and only the owner or a moderator can change it", async () => {
    const e = await as("seller2@marketplaceph.test");
    const id = await seedPost(e, ids.seller2);
    const stranger = await as("seller1@marketplaceph.test");
    expect((await stranger.from("job_posts").update({ status: "closed" }).eq("id", id).select("id")).data).toEqual([]);
    expect((await e.from("job_posts").update({ status: "closed" }).eq("id", id)).error).toBeNull();
    const admin = await as("admin@marketplaceph.test");
    expect((await admin.from("job_posts").update({ title: "Rewritten by admin" }).eq("id", id)).error?.message).toMatch(/only change the status/i);
    expect((await admin.from("job_posts").update({ status: "removed" }).eq("id", id)).error).toBeNull();
    expect((await anon().from("job_posts").select("id").eq("id", id)).data).toEqual([]);
  });
});

describe("applications, profile privacy and documents", () => {
  guarded("a profile is private until the seeker applies; then only that employer sees it", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const other = await as("seller3@marketplaceph.test");
    expect((await employer.from("job_profiles").select("user_id").eq("user_id", ids.seeker)).data).toEqual([]);
    expect((await anon().from("job_profiles").select("user_id")).data ?? []).toEqual([]);
    expect((await seeker.from("job_profiles").select("full_name").eq("user_id", ids.seeker).single()).data?.full_name).toBe("Buyer Demo");

    const post = await seedPost(employer, ids.seller2);
    expect((await seeker.rpc("apply_to_job", { p_post: post, p_note: "Hello", p_docs: [] })).error).toBeNull();
    expect((await employer.from("job_profiles").select("full_name, phone").eq("user_id", ids.seeker).single()).data?.full_name).toBe("Buyer Demo");
    expect((await other.from("job_profiles").select("user_id").eq("user_id", ids.seeker)).data).toEqual([]);
    expect((await employer.from("notifications").select("kind").eq("kind", "job_application_received")).data!.length).toBeGreaterThan(0);

    // withdrawing takes the profile away again
    const app = (await seeker.from("job_applications").select("id").eq("post_id", post).single()).data!;
    expect((await seeker.rpc("withdraw_application", { p_app: app.id })).error).toBeNull();
    expect((await employer.from("job_profiles").select("user_id").eq("user_id", ids.seeker)).data).toEqual([]);
  });

  guarded("application rules: consent, own post, duplicates, someone else's documents", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const post = await seedPost(employer, ids.seller2);
    expect((await employer.rpc("apply_to_job", { p_post: post })).error?.message).toMatch(/your own job post/i);
    expect((await anon().rpc("apply_to_job", { p_post: post })).error).not.toBeNull();

    const strangerDoc = await (async () => {
      const s1 = await as("seller1@marketplaceph.test");
      const { data } = await s1.from("job_documents").insert({ user_id: ids.seller1, kind: "resume", storage_path: `${ids.seller1}/x.pdf`, mime_type: "application/pdf", size_bytes: 10 } as never).select("id").single();
      return data!.id;
    })();
    expect((await seeker.rpc("apply_to_job", { p_post: post, p_docs: [strangerDoc] })).error?.message).toMatch(/documents was not found/i);
    await svc().from("job_documents").delete().eq("id", strangerDoc);

    await svc().from("job_profiles").update({ consent_at: null }).eq("user_id", ids.seeker);
    expect((await seeker.rpc("apply_to_job", { p_post: post })).error?.message).toMatch(/agree to share/i);
    await svc().from("job_profiles").update({ consent_at: new Date().toISOString() }).eq("user_id", ids.seeker);
    expect((await seeker.rpc("apply_to_job", { p_post: post })).error).toBeNull();
    expect((await seeker.rpc("apply_to_job", { p_post: post })).error?.message).toMatch(/already applied/i);

    const closed = await seedPost(employer, ids.seller2, { status: "closed" });
    expect((await seeker.rpc("apply_to_job", { p_post: closed })).error?.message).toMatch(/no longer open/i);
  });

  guarded("employers can open only the documents the seeker chose to share, and each open is logged", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const other = await as("seller3@marketplaceph.test");
    const shared = await addDoc(seeker, "resume", "resume1");
    const secret = await addDoc(seeker, "nbi_clearance", "nbi1");
    const post = await seedPost(employer, ids.seller2);

    // before applying, nothing is visible
    expect((await employer.from("job_documents").select("id").in("id", [shared, secret])).data).toEqual([]);
    expect((await employer.rpc("job_doc_open", { p_doc: shared })).error).not.toBeNull();

    expect((await seeker.rpc("apply_to_job", { p_post: post, p_docs: [shared] })).error).toBeNull();
    const visible = (await employer.from("job_documents").select("id").in("id", [shared, secret])).data!.map((d) => d.id);
    expect(visible).toEqual([shared]);
    const path = await employer.rpc("job_doc_open", { p_doc: shared });
    expect(path.data).toBe(`${ids.seeker}/resume1.pdf`);
    expect((await employer.rpc("job_doc_open", { p_doc: secret })).error?.message).toMatch(/not found/i);
    expect((await other.rpc("job_doc_open", { p_doc: shared })).error).not.toBeNull();
    expect((await anon().rpc("job_doc_open", { p_doc: shared })).error).not.toBeNull();

    // the seeker opening their own file is not logged; the employer's open is
    expect((await seeker.rpc("job_doc_open", { p_doc: secret })).data).toBe(`${ids.seeker}/nbi1.pdf`);
    const logs = (await svc().from("job_doc_access_logs").select("viewer_id, doc_id").eq("doc_id", shared)).data!;
    expect(logs).toHaveLength(1);
    expect(logs[0].viewer_id).toBe(ids.seller2);
    // logs are not readable by regular users
    expect((await employer.from("job_doc_access_logs").select("id")).data).toEqual([]);

    // a seeker cannot delete someone else's document, and the file path must be in their own folder
    expect((await other.from("job_documents").delete().eq("id", shared).select("id")).data).toEqual([]);
    expect((await seeker.from("job_documents").insert({ user_id: ids.seeker, kind: "resume", storage_path: `${ids.seller1}/hack.pdf`, mime_type: "application/pdf", size_bytes: 5 } as never)).error).not.toBeNull();
  });

  guarded("hiring workflow: only the post owner changes the status; the applicant is notified", async () => {
    const seeker = await as("buyer@marketplaceph.test");
    const employer = await as("seller2@marketplaceph.test");
    const other = await as("seller3@marketplaceph.test");
    const post = await seedPost(employer, ids.seller2);
    await seeker.rpc("apply_to_job", { p_post: post });
    const app = (await employer.from("job_applications").select("id, status").eq("post_id", post).single()).data!;
    expect(app.status).toBe("submitted");
    expect((await other.rpc("set_application_status", { p_app: app.id, p_status: "hired" })).error?.message).toMatch(/not found/i);
    expect((await seeker.rpc("set_application_status", { p_app: app.id, p_status: "hired" })).error?.message).toMatch(/not found/i);
    expect((await employer.rpc("set_application_status", { p_app: app.id, p_status: "teleported" })).error?.message).toMatch(/invalid status/i);
    expect((await employer.rpc("set_application_status", { p_app: app.id, p_status: "shortlisted", p_note: "Please bring ID" })).error).toBeNull();
    const mine = (await seeker.from("job_applications").select("status, employer_note").eq("id", app.id).single()).data!;
    expect(mine).toMatchObject({ status: "shortlisted", employer_note: "Please bring ID" });
    expect((await seeker.from("notifications").select("kind, params").eq("kind", "job_application_status")).data!.length).toBeGreaterThan(0);
    // applications cannot be forged or edited directly
    expect((await seeker.from("job_applications").update({ status: "hired" }).eq("id", app.id).select("id")).data).toEqual([]);
    expect((await seeker.from("job_applications").insert({ post_id: post, applicant_id: ids.seeker } as never)).error).not.toBeNull();
    expect((await other.from("job_applications").select("id").eq("id", app.id)).data).toEqual([]);
  });
});
