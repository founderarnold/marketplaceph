-- Admin tool: find a user's id by their sign-in email (used to pin someone to Featured). Full admins only.
create or replace function public.admin_find_user(p_email text) returns uuid
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_full_admin() then raise exception 'Admins only'; end if;
  return (select id from auth.users where lower(email) = lower(trim(p_email)) limit 1);
end $$;
revoke all on function public.admin_find_user(text) from public, anon;
grant execute on function public.admin_find_user(text) to authenticated;
