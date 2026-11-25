-- Rollback for 20261125000006_jobs_posting_tools.sql.
-- WARNING: removes saved jobs, hiring tags and job logo / creative links (the image files stay in storage).
drop table if exists public.saved_jobs;
drop index if exists public.job_posts_urgent;
alter table public.job_posts drop column if exists hiring_tags, drop column if exists logo_url, drop column if exists creative_url;
