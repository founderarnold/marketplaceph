-- Rollback for 20261125000004_jobs2_funnel_events.sql: back to the P2 event list. Events with names outside that
-- list must be removed first or the constraint cannot be restored (export them if needed).
drop function if exists public.purge_old_job_events(int);
drop view if exists public.job_funnel_daily;
delete from public.job_funnel_events where name not in ('jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'referral_attribution');
alter table public.job_funnel_events drop constraint if exists job_funnel_events_name_check;
alter table public.job_funnel_events add constraint job_funnel_events_name_check
  check (name in ('jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'referral_attribution'));
-- Then re-run the record_job_event() definition from 20261125000002_jobs2_landing_events.sql.
