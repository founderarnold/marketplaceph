-- Rollback for 20261125000002_jobs2_landing_events.sql. Turn the jobs2_landing flag off first.
-- WARNING: drops the event and saved-search rows collected since the migration (export them first if needed).
drop function if exists public.record_job_event(text, text, jsonb, jsonb);
drop table if exists public.job_funnel_events;
drop table if exists public.job_search_alerts;
