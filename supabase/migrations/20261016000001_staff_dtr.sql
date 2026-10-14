-- Staff Daily Time Record (DTR) for store owners: a staff list and daily time-in / time-out logs.
-- Owner-only (RLS). Adding or changing records needs FLAME Starter or higher (assert_tier(1));
-- reading and deleting stay open to the owner so data is never locked away after a plan lapses.

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  position text check (char_length(position) <= 60),
  shift_start time,                 -- scheduled start, for "late" minutes
  shift_end time,                   -- scheduled end, for "undertime" minutes
  daily_rate numeric(10, 2) check (daily_rate is null or daily_rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index staff_members_owner on public.staff_members (owner_id, active, name);

create table public.staff_time_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  staff_id uuid not null references public.staff_members (id) on delete cascade,
  work_date date not null,
  time_in timestamptz not null,
  time_out timestamptz,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (time_out is null or time_out > time_in)
);
create index staff_time_logs_owner_date on public.staff_time_logs (owner_id, work_date desc);
create index staff_time_logs_staff_date on public.staff_time_logs (staff_id, work_date desc);
-- At most one open (not yet timed-out) log per staff member.
create unique index staff_time_logs_one_open on public.staff_time_logs (staff_id) where time_out is null;

alter table public.staff_members enable row level security;
alter table public.staff_time_logs enable row level security;
create policy staff_members_own on public.staff_members for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy staff_time_logs_own on public.staff_time_logs for all using (owner_id = auth.uid()) with check (
  owner_id = auth.uid() and exists (select 1 from public.staff_members m where m.id = staff_id and m.owner_id = auth.uid())
);

create or replace function public.staff_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  perform public.assert_tier(1);
  if tg_table_name = 'staff_members' and tg_op = 'INSERT'
     and (select count(*) from public.staff_members where owner_id = new.owner_id) >= 100 then
    raise exception 'Staff list is full (100 people)';
  end if;
  return new;
end $$;

create trigger staff_members_guard before insert or update on public.staff_members for each row execute function public.staff_guard();
create trigger staff_time_logs_guard before insert or update on public.staff_time_logs for each row execute function public.staff_guard();
