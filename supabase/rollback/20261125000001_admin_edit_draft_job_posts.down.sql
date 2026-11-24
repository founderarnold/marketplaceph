-- Rollback for 20261125000001_admin_edit_draft_job_posts.sql: restores the original rule
-- (admins/moderators may change only the status of someone else's post) and removes the audit trigger.
-- Run manually only if the owner decides to roll back; no data is changed.

drop trigger if exists audit_job_posts on public.job_posts;

create or replace function public.job_posts_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'Cannot change the owner of a post'; end if;
  if auth.uid() is not null and auth.uid() <> old.owner_id and public.is_admin() then
    if (new.title, new.description, new.qualifications, new.company_name) is distinct from (old.title, old.description, old.qualifications, old.company_name) then
      raise exception 'Moderators can only change the status of a post';
    end if;
  end if;
  return new;
end $$;
