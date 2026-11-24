-- Rollback for 20261125000003_jobs2_employer_reviews.sql. Turn jobs2_employer_pipeline off first.
-- WARNING: drops the review records (export them first if they are needed for audit).
drop table if exists public.employer_reviews;
