-- Jobs 2.0 P7: full pilot funnel. Depends on 20261125000002 (job_funnel_events, record_job_event).
-- Changes only objects created by Jobs 2.0 migrations: widens the allowed event names, adds an admin-only daily
-- view and a retention function (not scheduled; the owner decides when to run it). No existing data is changed.
-- Rollback: supabase/rollback/20261125000004_jobs2_funnel_events.down.sql

alter table public.job_funnel_events drop constraint if exists job_funnel_events_name_check;
alter table public.job_funnel_events add constraint job_funnel_events_name_check check (name in (
  'jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'signup_complete', 'flame_link_result', 'referral_attribution',
  'profile_step_complete', 'profile_ready', 'resume_generated', 'apply_start', 'apply_submitted', 'apply_failed',
  'employer_viewed', 'status_changed', 'interview', 'hire_recorded', 'hire_confirmed', 'review_submitted'));

create or replace function public.record_job_event(p_name text, p_session text, p_props jsonb default '{}', p_attr jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  props jsonb := '{}';
  attr jsonb := '{}';
  k text;
  v text;
begin
  if p_name not in ('jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'signup_complete', 'flame_link_result', 'referral_attribution',
    'profile_step_complete', 'profile_ready', 'resume_generated', 'apply_start', 'apply_submitted', 'apply_failed',
    'employer_viewed', 'status_changed', 'interview', 'hire_recorded', 'hire_confirmed', 'review_submitted') then return; end if;
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{16,64}$' then return; end if;
  -- keep only allow-listed, short, safe values (no names, emails, phones, notes, search text or document names)
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_props, '{}')) loop
    if k in ('has_q', 'has_loc') and v in ('true', 'false') then props := props || jsonb_build_object(k, v::boolean);
    elsif k = 'results' and v in ('0', '1-5', '6-20', '21+') then props := props || jsonb_build_object(k, v);
    elsif k in ('category', 'source', 'status') and v ~ '^[a-z_]{1,30}$' then props := props || jsonb_build_object(k, v);
    elsif k in ('job_id', 'application_id') and v ~ '^[0-9a-f-]{36}$' then props := props || jsonb_build_object(k, v);
    end if;
  end loop;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_attr, '{}')) loop
    if k in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ch') and v ~ '^[a-z0-9][a-z0-9_.-]{0,39}$' and v !~ '[0-9]{7,}' then
      attr := attr || jsonb_build_object(k, v);
    end if;
  end loop;
  if (select count(*) from public.job_funnel_events where session_id = p_session and created_at > now() - interval '1 day') >= 300 then return; end if;
  insert into public.job_funnel_events (name, session_id, user_id, props, attribution) values (p_name, p_session, auth.uid(), props, attr);
end $$;
revoke all on function public.record_job_event(text, text, jsonb, jsonb) from public;
grant execute on function public.record_job_event(text, text, jsonb, jsonb) to anon, authenticated;

-- Daily funnel: counts only (sessions and signed-in members), by event and first-touch source / chapter code.
-- security_invoker: the table's RLS applies, so only full admins see rows.
create or replace view public.job_funnel_daily with (security_invoker = true) as
select date_trunc('day', created_at at time zone 'Asia/Manila')::date as day, name,
       coalesce(attribution ->> 'utm_source', '(direct)') as source, coalesce(attribution ->> 'ch', '') as chapter,
       count(*) as events, count(distinct session_id) as sessions, count(distinct user_id) as members
from public.job_funnel_events
group by 1, 2, 3, 4;

-- Retention: delete funnel events older than p_days (default 180). Not scheduled; run manually or via pg_cron if approved.
create or replace function public.purge_old_job_events(p_days int default 180) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_full_admin() and current_user not in ('postgres', 'service_role') then raise exception 'Not allowed'; end if;
  delete from public.job_funnel_events where created_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_old_job_events(int) from public, anon;
grant execute on function public.purge_old_job_events(int) to authenticated;
