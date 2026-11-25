"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  CIVIL_STATUSES, DOC_KINDS, DOC_MIME, EDUCATION_LEVELS, EMPLOYER_STATUSES, EMPLOYMENT_TYPES, JOB_CATEGORIES, MAX_DOC_BYTES, POSTER_TYPES,
  HIRING_TAGS, JOB_IMAGE_PATH, SALARY_PERIODS, SEX_OPTIONS, WORK_SETUPS, cleanAdminPlaceholders, hasAdminPlaceholder, splitList,
} from "@/lib/jobs";
import { isFullAdmin } from "@/lib/roles";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { recordJobEvent } from "@/app/actions/jobs2";

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

/** The applicant confirms the hiring the employer recorded: it then counts as a completed job transaction for both. */
export async function confirmHire(id: string): Promise<JobResult> {
  const { supabase } = await requireUser("/jobs/applications");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await supabase.rpc("confirm_hire", { p_app: id });
  revalidatePath("/jobs/applications");
  if (!error) await recordJobEvent("hire_confirmed", { application_id: id });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function setApplicationStatus(id: string, status: string, note: string): Promise<JobResult> {
  const p = z.object({ id: z.uuid(), status: z.enum(EMPLOYER_STATUSES), note: z.string().max(500) }).safeParse({ id, status, note });
  if (!p.success) return { ok: false, error: "invalid" };
  const { supabase } = await requireUser("/jobs/employer");
  const { error } = await supabase.rpc("set_application_status", { p_app: p.data.id, p_status: p.data.status, p_note: p.data.note });
  revalidatePath("/jobs/employer", "layout");
  if (!error) {
    // Jobs 2.0 funnel (no-op unless jobs2_landing is on): status only, never the note.
    await recordJobEvent("status_changed", { status: p.data.status, application_id: p.data.id });
    if (p.data.status === "interview") await recordJobEvent("interview", { application_id: p.data.id });
    if (p.data.status === "hired") await recordJobEvent("hire_recorded", { application_id: p.data.id });
  }
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/* ───────────── Employer posts ───────────── */
/** Hiring tags and public images from a post form (unknown tags and bad paths are dropped). */
function postExtras(fd: FormData) {
  const tags = [...new Set(fd.getAll("hiring_tags").map(String))].filter((x): x is (typeof HIRING_TAGS)[number] => (HIRING_TAGS as readonly string[]).includes(x));
  const img = (k: string) => { const v = String(fd.get(k) ?? "").trim(); return JOB_IMAGE_PATH.test(v) ? v : null; };
  return { hiring_tags: tags as string[], logo_url: img("logo_url"), creative_url: img("creative_url") };
}
const postObject = z
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
  });
const salaryOrder = (v: { salary_min: number | null; salary_max: number | null }) => v.salary_min == null || v.salary_max == null || v.salary_max >= v.salary_min;
const postSchema = postObject.refine(salaryOrder, { path: ["salary_max"] });

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
    .insert({ ...parsed.data, owner_id: userId, for_client: fd.get("for_client") === "on", requirement_docs: docs, ...postExtras(fd) })
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


/** Optional fields a form may leave out entirely (e.g. no province for NCR cities, no licence for employers). */
const OPTIONAL_POST_FIELDS = ["agency_license_no", "region_code", "province_code", "city_code", "qualifications", "salary_min", "salary_max", "salary_period", "deadline"] as const;
const withOptionalBlanks = (raw: Record<string, FormDataEntryValue>) => {
  const out: Record<string, unknown> = { ...raw };
  for (const k of OPTIONAL_POST_FIELDS) if (out[k] === undefined) out[k] = "";
  return out;
};

/* ───────────── Admin: edit and publish job posts (starter drafts) ───────────── */
/** Full admins only (admin, founder, webmaster). The database allows wording changes only while a post is hidden. */
async function requireFullAdmin(next: string) {
  const { supabase, userId } = await requireUser(next);
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return isFullAdmin(data?.role) ? { supabase, userId } : null;
}

const adminPostSchema = postObject.omit({ poster_type: true, agency_license_no: true }).extend({ id: z.uuid() }).refine(salaryOrder, { path: ["salary_max"] });

export async function adminUpdateJobPost(_prev: JobFormState, fd: FormData): Promise<JobFormState> {
  const raw = Object.fromEntries(fd);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const ctx = await requireFullAdmin("/admin?tab=jobs");
  if (!ctx) return { error: "forbidden", values };
  const parsed = adminPostSchema.safeParse(withOptionalBlanks(raw));
  if (!parsed.success) return { error: "invalid", values };
  const { id, ...row } = parsed.data;
  const { data: post } = await ctx.supabase.from("job_posts").select("status").eq("id", id).maybeSingle();
  if (!post || post.status === "removed") return { error: "invalid", values };
  const docs = fd.getAll("requirement_docs").map(String).filter((d) => (DOC_KINDS as readonly string[]).includes(d));
  const extras = postExtras(fd);
  const { error } = await ctx.supabase.from("job_posts").update({ ...row, requirement_docs: docs, ...extras, ...(extras.hiring_tags.includes("filled") && post.status === "active" ? { status: "closed" } : {}) }).eq("id", id);
  if (error) return { error: friendly(error.message), values };
  revalidatePath("/admin");
  revalidatePath("/jobs", "layout");
  return { ok: true, id, values };
}

/**
 * Publish (active) or unpublish (hidden) a post. Publishing always works: any "[ADMIN TO FILL …]" note left in a
 * draft is first replaced with applicant-friendly wording (while the post is still hidden, which the database
 * allows for full admins), so no placeholder is ever shown publicly. Empty pay fields stay empty.
 */
export async function adminSetJobPostStatus(id: string, status: "active" | "hidden"): Promise<JobResult> {
  if (!z.uuid().safeParse(id).success || !["active", "hidden"].includes(status)) return { ok: false, error: "invalid" };
  const ctx = await requireFullAdmin("/admin?tab=jobs");
  if (!ctx) return { ok: false, error: "forbidden" };
  if (status === "active") {
    const res = await publishOne(ctx.supabase, id);
    revalidatePath("/admin");
    revalidatePath("/jobs", "layout");
    return res;
  }
  const { error } = await ctx.supabase.from("job_posts").update({ status }).eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/jobs", "layout");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function publishOne(supabase: Db, id: string): Promise<JobResult> {
  const { data: post } = await supabase.from("job_posts").select("title, description, qualifications, status").eq("id", id).maybeSingle();
  if (!post || post.status === "removed") return { ok: false, error: "invalid" };
  if (post.status === "hidden" && hasAdminPlaceholder(post.title, post.description, post.qualifications)) {
    const { error: cleanError } = await supabase
      .from("job_posts")
      .update({
        title: cleanAdminPlaceholders(post.title) ?? post.title,
        description: cleanAdminPlaceholders(post.description) ?? post.description,
        qualifications: cleanAdminPlaceholders(post.qualifications),
      })
      .eq("id", id);
    if (cleanError) return { ok: false, error: friendly(cleanError.message) };
  }
  const { error } = await supabase.from("job_posts").update({ status: "active" }).eq("id", id);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Publishes every starter draft (hidden posts that still carry "[ADMIN TO FILL …]" notes) in one go. */
export async function adminPublishAllDrafts(): Promise<JobResult & { published?: number; failed?: number }> {
  const ctx = await requireFullAdmin("/admin?tab=jobs");
  if (!ctx) return { ok: false, error: "forbidden" };
  // Only starter drafts: posts an employer hid on purpose (no placeholder notes) are never re-opened here.
  const { data: drafts } = await ctx.supabase.from("job_posts").select("id").eq("status", "hidden").like("description", "%[ADMIN TO FILL%").limit(200);
  let published = 0;
  let failed = 0;
  for (const d of drafts ?? []) {
    const r = await publishOne(ctx.supabase, d.id);
    if (r.ok) published++;
    else failed++;
  }
  revalidatePath("/admin");
  revalidatePath("/jobs", "layout");
  return { ok: failed === 0, published, failed };
}

/* ───────────── Employers / agencies: edit their own post (published or not) ───────────── */
const ownerPostSchema = postObject.omit({ poster_type: true }).extend({ id: z.uuid() }).refine(salaryOrder, { path: ["salary_max"] });

/**
 * The post owner edits their own job post. RLS allows only owner_id = auth.uid(), the query is also limited to the
 * owner, the anti-fee / agency-licence trigger (job_posts_guard) still checks the new text, and applications are
 * untouched (they reference the post by id).
 */
export async function updateMyJobPost(_prev: JobFormState, fd: FormData): Promise<JobFormState> {
  const raw = Object.fromEntries(fd);
  const values = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = ownerPostSchema.safeParse(withOptionalBlanks(raw));
  if (!parsed.success) return { error: "invalid", values };
  const { supabase, userId } = await requireUser(`/jobs/employer/${parsed.data.id}/edit`);
  const { id, ...row } = parsed.data;
  const { data: post } = await supabase.from("job_posts").select("owner_id, status, poster_type").eq("id", id).maybeSingle();
  if (!post || post.owner_id !== userId) return { error: "forbidden", values };
  if (post.status === "removed") return { error: "removed", values };
  if (post.poster_type !== "agency") row.agency_license_no = null;
  const docs = fd.getAll("requirement_docs").map(String).filter((d) => (DOC_KINDS as readonly string[]).includes(d));
  const { data: updated, error } = await supabase
    .from("job_posts")
    .update({ ...row, requirement_docs: docs, ...postExtras(fd), ...(postExtras(fd).hiring_tags.includes("filled") && post.status === "active" ? { status: "closed" as const } : {}) })
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id");
  if (error) return { error: friendly(error.message), values };
  if (!updated?.length) return { error: "forbidden", values };
  revalidatePath("/jobs", "layout");
  revalidatePath(`/jobs/${id}`);
  return { ok: true, id, values };
}

/* ───────────── Posting tools: duplicate, filled, saved jobs ───────────── */
const COPY_FIELDS = "owner_id, poster_type, company_name, agency_license_no, for_client, title, category, description, qualifications, requirement_docs, employment_type, work_setup, region_code, province_code, city_code, salary_min, salary_max, salary_period, vacancies, deadline, hiring_tags, logo_url, creative_url, status";

/**
 * Copies a job post into a new HIDDEN draft with the same owner, so it can be revised (e.g. another branch's location)
 * and published. Applications are never copied. Owners copy their own posts; full admins can copy any post and the
 * copy keeps the original owner (inserted with the server key after the admin check, and recorded in audit_logs).
 */
export async function duplicateJobPost(id: string): Promise<JobResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser("/jobs/employer");
  const { data: src } = await supabase.from("job_posts").select(COPY_FIELDS).eq("id", id).maybeSingle();
  if (!src || src.status === "removed") return { ok: false, error: "invalid" };
  const { owner_id, status: _s, ...fields } = src;
  void _s;
  const copy = { ...fields, owner_id, status: "hidden" as const, title: `${src.title} (copy)`.slice(0, 120), hiring_tags: (src.hiring_tags ?? []).filter((x) => x !== "filled") };
  if (owner_id === userId) {
    const { data, error } = await supabase.from("job_posts").insert(copy).select("id").single();
    if (error || !data) return { ok: false, error: friendly(error?.message) };
    revalidatePath("/jobs/employer");
    return { ok: true, id: data.id };
  }
  const admin = await requireFullAdmin("/admin?tab=jobs");
  if (!admin) return { ok: false, error: "forbidden" };
  const service = createAdminClient();
  const { data, error } = await service.from("job_posts").insert(copy).select("id").single();
  if (error || !data) return { ok: false, error: friendly(error?.message) };
  await service.from("audit_logs").insert({ actor_id: userId, action: "DUPLICATE", table_name: "job_posts", record_id: data.id, old_data: { source_id: id }, new_data: null });
  revalidatePath("/admin");
  return { ok: true, id: data.id };
}

/** "Hired / position filled": adds the Filled tag and closes the post (owner or admin). */
export async function markJobFilled(id: string): Promise<JobResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase } = await requireUser("/jobs/employer");
  const { data: post } = await supabase.from("job_posts").select("hiring_tags, status").eq("id", id).maybeSingle();
  if (!post || post.status === "removed") return { ok: false, error: "invalid" };
  const tags = [...new Set([...(post.hiring_tags ?? []), "filled"])];
  const { error } = await supabase.from("job_posts").update({ hiring_tags: tags, status: "closed" }).eq("id", id);
  revalidatePath("/jobs", "layout");
  revalidatePath("/admin");
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Save or unsave a job for the signed-in job seeker (private list). */
export async function toggleSavedJob(postId: string): Promise<JobResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "invalid" };
  const { supabase, userId } = await requireUser(`/jobs/${postId}`);
  const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;
  const { data: row } = await db.from("saved_jobs").select("post_id").eq("user_id", userId).eq("post_id", postId).maybeSingle();
  const { error } = row
    ? await db.from("saved_jobs").delete().eq("user_id", userId).eq("post_id", postId)
    : await db.from("saved_jobs").insert({ user_id: userId, post_id: postId });
  revalidatePath("/jobs/applications");
  return error ? { ok: false, error: /policy|row-level/i.test(error.message) ? "limit" : "failed" } : { ok: true };
}
