-- Full admins may edit the wording of any job post, published or hidden (owner request, 25 Nov 2026).
-- Reversible: only replaces job_posts_protect(). Rollback: supabase/rollback/20261125000005_admin_edit_published_job_posts.down.sql
--
-- Before (20261125000001): full admins could change wording only while a post was hidden.
-- After: full admins (admin, founder, webmaster) may change wording on any post. Moderators still change status only.
-- Post owners (employers / agencies) were and remain able to edit their own posts (RLS: owner_id = auth.uid()).
-- Nobody may change a post's owner. job_posts_guard (no-fee wording, agency licence) still runs on every edit, and
-- the audit_job_posts trigger from 20261125000001 still logs every admin change in audit_logs.

create or replace function public.job_posts_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'Cannot change the owner of a post'; end if;
  if auth.uid() is not null and auth.uid() <> old.owner_id and public.is_admin() then
    if (new.title, new.description, new.qualifications, new.company_name) is distinct from (old.title, old.description, old.qualifications, old.company_name)
       and not public.is_full_admin() then
      raise exception 'Moderators can only change the status of a post';
    end if;
  end if;
  return new;
end $$;
