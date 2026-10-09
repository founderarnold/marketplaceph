-- More shop categories, job-applicant ⇄ employer messaging, and message notifications for the shop chat.

-- ───────────────────────── Categories ─────────────────────────
insert into public.categories (slug, name_en, name_fil, icon, sort_order) values
  ('import-brokerage', 'Import & Brokerage Services', 'Import at Brokerage Services', 'ship', 14),
  ('trucking-logistics', 'Trucking & Logistics', 'Trucking at Logistics', 'truck', 15),
  ('couriers-pasabuy', 'Couriers & Pasabuy', 'Courier at Pasabuy', 'bike', 16),
  ('advertising-marketing', 'Advertising & Marketing', 'Advertising at Marketing', 'megaphone', 17),
  ('catering-concession', 'Catering & Concession', 'Catering at Concession', 'chef-hat', 18),
  ('accounting-tax', 'Accounting & Tax Compliance', 'Accounting at Tax Compliance', 'calculator', 19),
  ('rebrand-giveaways', 'Rebrand Items & Corporate Giveaways', 'Rebrand Items at Corporate Giveaways', 'sparkles', 20)
on conflict (slug) do nothing;

-- ───────────────────────── Job messaging ─────────────────────────
-- One thread per application. Both sides can write once there is an application that has not been withdrawn.
create table public.job_threads (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.job_applications (id) on delete cascade,
  employer_id uuid not null references public.profiles (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index job_threads_employer on public.job_threads (employer_id, last_message_at desc);
create index job_threads_applicant on public.job_threads (applicant_id, last_message_at desc);

create table public.job_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.job_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index job_messages_thread on public.job_messages (thread_id, created_at);

create or replace function public.is_job_thread_participant(p_thread uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_threads t where t.id = p_thread and auth.uid() in (t.employer_id, t.applicant_id));
$$;

alter table public.job_threads enable row level security;
alter table public.job_messages enable row level security;
create policy job_threads_read on public.job_threads for select using (auth.uid() in (employer_id, applicant_id));
-- no insert policy: threads are created only by open_job_thread()
create policy job_messages_read on public.job_messages for select using (public.is_job_thread_participant(thread_id));
create policy job_messages_insert on public.job_messages for insert with check (
  sender_id = auth.uid() and public.is_job_thread_participant(thread_id)
  and not exists (select 1 from public.job_threads t join public.job_applications a on a.id = t.application_id
                   where t.id = thread_id and a.status = 'withdrawn')
);

-- Find or create the thread for an application (caller must be the applicant or the employer who owns the post).
create or replace function public.open_job_thread(p_app uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a record; p record; tid uuid;
begin
  select * into a from public.job_applications where id = p_app;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.job_posts where id = a.post_id;
  if auth.uid() is null or auth.uid() not in (a.applicant_id, p.owner_id) then raise exception 'Application not found'; end if;
  select id into tid from public.job_threads where application_id = p_app;
  if tid is null then
    insert into public.job_threads (application_id, employer_id, applicant_id) values (p_app, p.owner_id, a.applicant_id) returning id into tid;
  end if;
  return tid;
end $$;

create or replace function public.job_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; other uuid; title text; sender_name text; had_unread boolean;
begin
  if (select count(*) from public.job_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = 'P0001';
  end if;
  select * into t from public.job_threads where id = new.thread_id;
  other := case when new.sender_id = t.employer_id then t.applicant_id else t.employer_id end;
  update public.job_threads set last_message_at = now() where id = new.thread_id;
  -- one notification per burst: skip if the other person already has an unread message from this sender
  select exists (select 1 from public.job_messages where thread_id = new.thread_id and sender_id = new.sender_id and read_at is null and id <> new.id) into had_unread;
  if not had_unread then
    select p.title into title from public.job_applications a join public.job_posts p on p.id = a.post_id where a.id = t.application_id;
    select coalesce(display_name, 'Someone') into sender_name from public.profiles where id = new.sender_id;
    perform public.notify(other, 'job_message', jsonb_build_object('name', left(sender_name, 40), 'title', left(title, 60)), '/jobs/messages/' || t.application_id);
  end if;
  return new;
end $$;
create trigger job_messages_guard_t after insert on public.job_messages for each row execute function public.job_message_guard();

create or replace function public.mark_job_thread_read(p_thread uuid) returns void
language sql security definer set search_path = public as $$
  update public.job_messages set read_at = now()
   where thread_id = p_thread and sender_id <> auth.uid() and read_at is null and public.is_job_thread_participant(p_thread);
$$;

alter publication supabase_realtime add table public.job_messages;

-- ───────────────────────── Shop chat: notify the other person ─────────────────────────
create or replace function public.message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; owner uuid; other uuid; sender_name text; had_unread boolean;
begin
  select cv.*, s.owner_id as store_owner, s.name as store_name into c from public.conversations cv join public.stores s on s.id = cv.store_id where cv.id = new.conversation_id;
  other := case when new.sender_id = c.buyer_id then c.store_owner else c.buyer_id end;
  select exists (select 1 from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id and read_at is null and id <> new.id) into had_unread;
  if not had_unread then
    sender_name := case when new.sender_id = c.buyer_id then (select coalesce(display_name, 'A buyer') from public.profiles where id = new.sender_id) else c.store_name end;
    perform public.notify(other, 'new_message', jsonb_build_object('name', left(sender_name, 40)), '/messages/' || new.conversation_id);
  end if;
  return new;
end $$;
create trigger messages_notify_t after insert on public.messages for each row execute function public.message_notify();

-- ───────────────────────── Grants ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array['open_job_thread(uuid)', 'mark_job_thread_read(uuid)', 'is_job_thread_participant(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
