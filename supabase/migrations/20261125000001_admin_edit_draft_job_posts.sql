-- Admins may edit the wording of a job post while it is a hidden draft (Task B: starter job posts).
-- Additive and reversible: it only replaces job_posts_protect() and adds an audit trigger.
-- Rollback: supabase/rollback/20261125000001_admin_edit_draft_job_posts.down.sql
--
-- Before: any admin/moderator could change only the status of someone else's post.
-- After:  full admins (admin, founder, webmaster) may also change the wording and details of a post that is
--         currently hidden (a draft), so starter posts can be prepared and then published. Moderators and live
--         posts keep the old rule. Nobody may change a post's owner. Every admin change is logged in audit_logs.

create or replace function public.job_posts_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'Cannot change the owner of a post'; end if;
  if auth.uid() is not null and auth.uid() <> old.owner_id and public.is_admin() then
    if (new.title, new.description, new.qualifications, new.company_name) is distinct from (old.title, old.description, old.qualifications, old.company_name)
       and not (old.status = 'hidden' and public.is_full_admin()) then
      raise exception 'Moderators can only change the status of a post';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists audit_job_posts on public.job_posts;
create trigger audit_job_posts after update on public.job_posts
  for each row execute function public.log_admin_change();
