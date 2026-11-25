/**
 * Ready-made job post templates (the 19 starter roles) for "Start from a template" on the Post a job form.
 * Text comes from scripts/starter-jobs.mjs; the admin-only "[ADMIN TO FILL …]" notes are turned into neutral wording.
 */
import { JOBS, descriptionOf, qualificationsOf } from "../scripts/starter-jobs.mjs";
import { cleanAdminPlaceholders } from "@/lib/jobs";

export type JobTemplate = { key: string; title: string; category: string; employment_type: string; work_setup: string; description: string; qualifications: string };

type Starter = { key: string; title: string; category: string; employment_type: string; work_setup: string };

export const JOB_TEMPLATES: JobTemplate[] = (JOBS as Starter[]).map((j) => ({
  key: j.key,
  title: j.title,
  category: j.category,
  employment_type: j.employment_type,
  work_setup: j.work_setup,
  description: cleanAdminPlaceholders(descriptionOf(j)) ?? "",
  qualifications: qualificationsOf(j),
}));
