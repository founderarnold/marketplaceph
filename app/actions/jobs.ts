"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  CIVIL_STATUSES, DOC_KINDS, DOC_MIME, EDUCATION_LEVELS, EMPLOYER_STATUSES, EMPLOYMENT_TYPES, JOB_CATEGORIES, MAX_DOC_BYTES, POSTER_TYPES,
  SALARY_PERIODS, SEX_OPTIONS, WORK_SETUPS, splitList,
} from "@/lib/jobs";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type JobFormState = { error?: string; values?: Record<string, string>; ok?: boolean; id?: string } | undefined;
export type JobResult = { ok: boolean; error?: string; id?: string };

async function requireUser(next = "/jobs") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const text = (max: number) => z.preprocess(empty, z.string().trim().max(max).nullable());
const num = z.preprocess(empty, z.coerce.number().min(0).max(100_000_000).nullable());
const code = z.preprocess(empty, z.string().max(40).nullable());

/** Friendly message for a database error (raw SQL text is never shown). */
function friendly(message?: string): string {
  if (!message) return "failed";
  if (/violates|constraint|schema cache|function public\.|duplicate key/i.test(message)) return "failed";
  return message;
}

/* ───────────── Seeker profile ───────────── */
const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  headline: text(100),
  phone: text(20),
  contact_email: z.preprocess(empty, z.email().max(120).nullable()),
  birthdate: z.preprocess(empty, z.iso.date().nullable()),
  sex: z.preprocess(empty, z.enum(SEX_OPTIONS).nullable()),
  civil_status: z.preprocess(empty, z.enum(CIVIL_STATUSES).nullable()),
  region_code: code,
  province_code: code,
  city_code: code,
  address_note: text(200),
  about: text(1500),
  education_level: z.preprocess(empty, z.enum(EDUCATION_LEVELS).nullable()),
  experience_years: z.preprocess(empty, z.coerce.number().int().min(0).max(60).nullable()),
  desired_roles: text(200),
  expected_salary_min: num,
  expected_salary_max: num,
});

export async function saveJobProfile(_prev: JobFormState, fd: FormData): Promise<JobFormState> {
  const { supabase, userId } = await requireUser("/jobs/profile");
  const raw = Object.fromEntries(fd);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", values };
  if (fd.get("consent") !== "on") return { error: "consent", values };

  const history = [0, 1, 2]
    .map((i) => ({
      company: String(fd.get(`wh_company_${i}`) ?? "").trim().slice(0, 80),
      role: String(fd.get(`wh_role_${i}`) ?? "").trim().slice(0, 80),
      from: String(fd.get(`wh_from_${i}`) ?? "").trim().slice(0, 10),
      to: String(fd.get(`wh_to_${i}`) ?? "").trim().slice(0, 10),
      notes: String(fd.get(`wh_notes_${i}`) ?? "").trim().slice(0, 300),
    }))
    .filter((h) => h.company || h.role);
  const jobTypes = fd.getAll("job_types").map(String).filter((x): x is (typeof EMPLOYMENT_TYPES)[number] => (EMPLOYMENT_TYPES as readonly string[]).includes(x));

  const { data: existing } = await supabase.from("job_profiles").select("consent_at").eq("user_id", userId).maybeSingle();
  const row = {
    ...parsed.data,
    user_id: userId,
    skills: splitList(String(fd.get("skills") ?? "")),
    job_types: jobTypes,
    work_history: history,
    open_to_work: fd.get("open_to_work") === "on",
    consent_at: existing?.consent_at ?? new Date().toISOString(),
  };
  const { error } = await supabase.from("job_profiles").upsert(row);
  if (error) return { error: friendly(error.message), values };
  revalidatePath("/jobs/profile");
  return { ok: true, values: { saved: "1", ...values } };
}

/* ───────────── Seeker documents (files go straight to private storage from the browser) ───────────── */
const docSchema = z.object({
  kind: z.enum(DOC_KINDS),
  title: z.string().trim().max(80).optional(),
  path: z.string().min(10).max(200),
  mime: z.enum(DOC_MIME),
  size: z.number().int().min(1).max(MAX_DOC_BYTES),
});

export async function addJobDocument(input: z.input<typeof docSchema>): Promise<JobResult> {
  const { supabase, userId } = await requireUser("/jobs/profile");
  const p = docSchema.safeParse(input);
  if (!p.success || !p.data.path.startsWith(`${userId}/`)) return { ok: false, error: "invalid" };
  const { data, error } = await supabase
    .from("job_documents")
    .insert({ user_id: userId, kind: p.data.kind, title: p.data.title || null, storage_path: p.data.path, mime_type: p.data.mime, size_bytes: p.data.size })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("job-documents").remove([p.data.path]);
    return { ok: false, error: friendly(error.message) };
  }
  revalidatePath("/jobs/profile");
  return { ok: true, id: data.id };
}

export async function deleteJobDocument(id: string): Promise<JobResult> {
  const { supabase, userId } = await requireUser("/jobs/profile");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { data: doc } = await supabase.from("job_documents").select("storage_path").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!doc) return { ok: false, error: "not_found" };
  await supabase.storage.from("job-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("job_documents").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/jobs/profile");
  return error ? { ok: false, error: "failed" } : { ok: true };
}

/** Opens a document with a 60-second signed URL. The database decides who may open it and logs employer access. */
export async function getJobDocumentUrl(id: string): Promise<{ url?: string; error?: string }> {
  if (!z.uuid().safeParse(id).success) return { error: "invalid" };
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("job_doc_open", { p_doc: id });
  if (error || !path) return { error: "not_found" };
  const signed = await createAdminClient().storage.from("job-documents").createSignedUrl(path, 60);
  return signed.error || !signed.data ? { error: "sign_failed" } : { url: signed.data.signedUrl };
}

/* ───────────── Applications ───────────── */
export async function applyToJob(postId: string, note: string, docIds: string[]): Promise<JobResult> {
  const p = z.object({ post: z.uuid(), note: z.string().max(1000), docs: z.array(z.uuid()).max(25) }).safeParse({ post: postId, note, docs: docIds });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await requireUser(`/jobs/${postId}`);
  const { error } = await supabase.rpc("apply_to_job", { p_post: p.data.post, p_note: p.data.note, p_docs: p.data.docs });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(`/jobs/${postId}`);
  revalidatePath("/jobs/applications");
  return { ok: true };
}

export async function withdrawApplication(id: string): Promise<JobResult> {
  const { supabase } = await requireUser("/jobs/applications");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await supabase.rpc("withdraw_application", { p_app: id });
  revalidatePath("/jobs/applications");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function setApplicationStatus(id: string, status: string, note: string): Promise<JobResult> {
  const p = z.object({ id: z.uuid(), status: z.enum(EMPLOYER_STATUSES), note: z.string().max(500) }).safeParse({ id, status, note });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await requireUser("/jobs/employer");
  const { error } = await supabase.rpc("set_application_status", { p_app: p.data.id, p_status: p.data.status, p_note: p.data.note });
  revalidatePath("/jobs/employer", "layout");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/* ───────────── Employer posts ───────────── */
const postSchema = z
  .object({
    poster_type: z.enum(POSTER_TYPES),
    company_name: z.string().trim().min(2).max(100),
    agency_license_no: text(60),
    title: z.string().trim().min(3).max(120),
    category: z.enum(JOB_CATEGORIES),
    description: z.string().trim().min(20).max(5000),
    qualifications: text(3000),
    employment_type: z.enum(EMPLOYMENT_TYPES),
    work_setup: z.enum(WORK_SETUPS),
    region_code: code,
    province_code: code,
    city_code: code,
    salary_min: num,
    salary_max: num,
    salary_period: z.preprocess(empty, z.enum(SALARY_PERIODS).nullable()),
    vacancies: z.coerce.number().int().min(1).max(1000),
    deadline: z.preprocess(empty, z.iso.date().nullable()),
  })
  .refine((v) => v.salary_min == null || v.salary_max == null || v.salary_max >= v.salary_min, { path: ["salary_max"] });

export async function createJobPost(_prev: JobFormState, fd: FormData): Promise<JobFormState> {
  const { supabase, userId } = await requireUser("/jobs/post");
  const raw = Object.fromEntries(fd);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid", values };
  if (fd.get("no_fees") !== "on") return { error: "no_fees", values };
  const docs = fd.getAll("requirement_docs").map(String).filter((d) => (DOC_KINDS as readonly string[]).includes(d));
  const { data, error } = await supabase
    .from("job_posts")
    .insert({ ...parsed.data, owner_id: userId, for_client: fd.get("for_client") === "on", requirement_docs: docs })
    .select("id")
    .single();
  if (error || !data) return { error: friendly(error?.message), values };
  revalidatePath("/jobs");
  redirect(`/jobs/employer/${data.id}?posted=1`);
}

export async function setPostStatus(id: string, status: "active" | "closed" | "hidden"): Promise<JobResult> {
  const { supabase } = await requireUser("/jobs/employer");
  if (!z.uuid().safeParse(id).success || !["active", "closed", "hidden"].includes(status)) return { ok: false, error: "invalid" };
  const { error } = await supabase.from("job_posts").update({ status }).eq("id", id);
  revalidatePath("/jobs", "layout");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Moderators: remove or restore a post (the database allows only the status column for them). */
export async function moderateJobPost(id: string, status: "removed" | "active"): Promise<JobResult> {
  const { supabase } = await requireUser("/admin");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await supabase.from("job_posts").update({ status }).eq("id", id);
  revalidatePath("/jobs", "layout");
  revalidatePath("/admin");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}
