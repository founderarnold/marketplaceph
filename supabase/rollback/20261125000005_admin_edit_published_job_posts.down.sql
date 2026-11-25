-- Rollback for 20261125000005: back to "full admins may edit wording only while a post is hidden" (20261125000001).
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
