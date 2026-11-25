-- Rollback for 20261125000008_jobs_applicant_companion.sql.
-- WARNING: removes the 'on_call' tag from any post that has it (needed to restore the old tag list) and the re-apply counters.
update public.job_posts set hiring_tags = array_remove(hiring_tags, 'on_call') where 'on_call' = any (hiring_tags);
alter table public.job_posts drop constraint if exists job_posts_hiring_tags_check;
alter table public.job_posts add constraint job_posts_hiring_tags_check
  check (hiring_tags <@ array['urgent', 'few_slots', 'wait_list', 'seasonal', 'filled']::text[]);
drop function if exists public.reapply_to_job(uuid, text);
alter table public.job_applications drop column if exists reapplied_at, drop column if exists reapply_count;

-- Restore the chat update function from 20261019000002_transactions_in_chat.sql.
create or replace function public.job_applications_chat_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; tid uuid; k text; sender uuid;
begin
  select * into p from public.job_posts where id = new.post_id;
  if tg_op = 'INSERT' then k := 'applied'; sender := new.applicant_id;
  elsif new.applicant_confirmed_at is not null and old.applicant_confirmed_at is null then k := 'hire_confirmed'; sender := new.applicant_id;
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
