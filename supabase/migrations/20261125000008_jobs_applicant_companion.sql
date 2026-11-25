-- Jobs applicant companion (owner request, 25 Nov 2026).
-- 1. A new hiring tag 'on_call' (On-call job) so seekers can filter for it, next to Seasonal hire.
-- 2. Re-Apply: an applicant may send a withdrawn application again at any time, or a not-selected one after 14 days,
--    while the post is still open. At most 3 re-applies per application and one per 7 days, so employers are not spammed.
-- 3. The chat update card for a re-apply comes from the applicant ("re-applied"), not from the employer.
-- Additive: one constraint widened, two new columns with defaults, one new function, one function re-created with
-- the same behaviour plus the re-apply case. No rows are changed or removed.
-- Rollback: supabase/rollback/20261125000008_jobs_applicant_companion.down.sql

-- 1. Hiring tags: same list as before plus 'on_call'.
alter table public.job_posts drop constraint if exists job_posts_hiring_tags_check;
alter table public.job_posts add constraint job_posts_hiring_tags_check
  check (hiring_tags <@ array['urgent', 'few_slots', 'wait_list', 'seasonal', 'on_call', 'filled']::text[]);

-- 2. Re-apply bookkeeping.
alter table public.job_applications
  add column if not exists reapplied_at timestamptz,
  add column if not exists reapply_count smallint not null default 0 check (reapply_count between 0 and 3);

create or replace function public.reapply_to_job(p_app uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a record; p record; prof record;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  perform public.assert_not_restricted(uid);
  select * into a from public.job_applications where id = p_app and applicant_id = uid for update;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.job_posts where id = a.post_id and status = 'active' and (deadline is null or deadline >= current_date);
  if not found then raise exception 'This job is no longer open'; end if;
  select * into prof from public.job_profiles where user_id = uid;
  if not found or prof.consent_at is null then raise exception 'Please complete your job profile and agree to share it before applying'; end if;
  if a.status not in ('withdrawn', 'rejected') then raise exception 'You can re-apply only to a withdrawn or not-selected application'; end if;
  if a.status = 'rejected' and a.updated_at > now() - interval '14 days' then
    raise exception 'You can re-apply 14 days after the employer''s answer' using errcode = 'P0001';
  end if;
  if a.reapply_count >= 3 then raise exception 'You have re-applied to this job 3 times already' using errcode = 'P0001'; end if;
  if a.reapplied_at is not null and a.reapplied_at > now() - interval '7 days' then
    raise exception 'You can re-apply once a week' using errcode = 'P0001';
  end if;
  update public.job_applications
     set status = 'submitted', employer_note = null, reapplied_at = now(), reapply_count = a.reapply_count + 1,
         note = coalesce(left(nullif(trim(p_note), ''), 1000), note)
   where id = p_app;
  perform public.notify(p.owner_id, 'job_application_received', jsonb_build_object('title', left(p.title, 60), 'name', prof.full_name), '/jobs/employer/' || p.id);
end $$;

revoke all on function public.reapply_to_job(uuid, text) from public, anon;
grant execute on function public.reapply_to_job(uuid, text) to authenticated;

-- 3. Same as 20261019000002 plus: a change back to 'submitted' (a re-apply) is sent by the applicant as 'reapplied'.
create or replace function public.job_applications_chat_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; tid uuid; k text; sender uuid;
begin
  select * into p from public.job_posts where id = new.post_id;
  if tg_op = 'INSERT' then k := 'applied'; sender := new.applicant_id;
  elsif new.applicant_confirmed_at is not null and old.applicant_confirmed_at is null then k := 'hire_confirmed'; sender := new.applicant_id;
  elsif new.status is distinct from old.status and new.status = 'submitted' then k := 'reapplied'; sender := new.applicant_id;
  elsif new.status is distinct from old.status and new.status <> 'viewed' then
    k := new.status; sender := case when new.status = 'withdrawn' then new.applicant_id else p.owner_id end;
  else return null;
  end if;
  insert into public.job_threads (application_id, employer_id, applicant_id) values (new.id, p.owner_id, new.applicant_id)
    on conflict (application_id) do nothing;
  select id into tid from public.job_threads where application_id = new.id;
  insert into public.job_messages (thread_id, sender_id, body, is_system, system_kind, system_link)
    values (tid, sender, left('Application update (' || k || '): ' || p.title, 500), true, 'job.' || k,
            case when sender = new.applicant_id then '/jobs/employer/' || p.id else '/jobs/applications' end);
  return null;
end $$;
