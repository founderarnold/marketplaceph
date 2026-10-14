-- Public social & contact links on a member's profile (Facebook page/account, website, Instagram, WhatsApp, Viber, …),
-- shown next to their store, items, job posts and buyer page so others can check they are legit.
-- New table only: existing profiles, stores and listings are not changed.

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('facebook_page', 'facebook', 'website', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'viber',
                                     'telegram', 'linkedin', 'x', 'shopee', 'lazada', 'other')),
  value text not null check (char_length(value) between 3 and 300),
  label text check (char_length(label) <= 40),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  -- Web links must be plain http(s) addresses (never javascript: or data:); phone apps take a phone number.
  check (
    case when kind in ('whatsapp', 'viber') then value ~ '^\+?[0-9][0-9 -]{6,19}$'
         when kind = 'telegram' then value ~ '^(https://t\.me/[A-Za-z0-9_]{3,40}|@?[A-Za-z0-9_]{3,40})$'
         else value ~* '^https?://[^\s<>"'']+$' end
  )
);
create index profile_links_user on public.profile_links (user_id, position);
alter table public.profile_links enable row level security;
create policy profile_links_read on public.profile_links for select using (true);
create policy profile_links_write on public.profile_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.profile_links_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.profile_links where user_id = new.user_id) >= 15 then
    raise exception 'You can add up to 15 links' using errcode = 'P0001';
  end if;
  if new.label is not null then perform public.assert_clean_text(new.label); end if;
  return new;
end $$;
create trigger profile_links_guard before insert or update on public.profile_links for each row execute function public.profile_links_guard();

-- Replace all of my links in one step (the edit form saves the whole list at once).
create or replace function public.set_profile_links(p_links jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare me uuid := auth.uid(); it jsonb; pos int := 0;
begin
  if me is null then raise exception 'Please sign in'; end if;
  if jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 15 then raise exception 'You can add up to 15 links'; end if;
  delete from public.profile_links where user_id = me;
  for it in select * from jsonb_array_elements(p_links) loop
    insert into public.profile_links (user_id, kind, value, label, position)
      values (me, it ->> 'kind', trim(it ->> 'value'), nullif(trim(coalesce(it ->> 'label', '')), ''), pos);
    pos := pos + 1;
  end loop;
end $$;
revoke all on function public.set_profile_links(jsonb) from public, anon;
grant execute on function public.set_profile_links(jsonb) to authenticated;
