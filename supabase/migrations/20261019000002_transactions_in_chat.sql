-- Order and job progress now also appears in Messages, as system update cards, so both sides see each step where they
-- already talk. Applicants confirm a hiring, and every profile can show its count of successful transactions.
-- Adds columns with defaults and new triggers; existing messages, orders and applications are unchanged.

/* ───────── System update messages ───────── */

alter table public.messages
  add column is_system boolean not null default false,
  add column system_kind text check (char_length(system_kind) <= 40),
  add column system_link text check (char_length(system_link) <= 200);
alter table public.job_messages
  add column is_system boolean not null default false,
  add column system_kind text check (char_length(system_kind) <= 40),
  add column system_link text check (char_length(system_link) <= 200);

-- People can never post a "system" card themselves; only the triggers below can.
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_conversation_participant(conversation_id) and not is_system and system_kind is null and system_link is null
);
drop policy job_messages_insert on public.job_messages;
create policy job_messages_insert on public.job_messages for insert with check (
  sender_id = auth.uid() and public.is_job_thread_participant(thread_id) and not is_system and system_kind is null and system_link is null
  and not exists (select 1 from public.job_threads t join public.job_applications a on a.id = t.application_id
                   where t.id = job_messages.thread_id and a.status = 'withdrawn')
);

-- Update cards skip the chat speed limit and the "new message" notification (each step already sends its own).
create or replace function public.message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if not new.is_system then
    select count(*) into recent from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if recent >= 20 then raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = 'P0001'; end if;
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

create or replace function public.message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; other uuid; sender_name text; had_unread boolean;
begin
  if new.is_system then return new; end if;
  select cv.*, s.owner_id as store_owner, s.name as store_name into c from public.conversations cv join public.stores s on s.id = cv.store_id where cv.id = new.conversation_id;
  other := case when new.sender_id = c.buyer_id then c.store_owner else c.buyer_id end;
  select exists (select 1 from public.messages where conversation_id = new.conversation_id and sender_id = new.sender_id and read_at is null and id <> new.id and not is_system) into had_unread;
  if not had_unread then
    sender_name := case when new.sender_id = c.buyer_id then (select coalesce(display_name, 'A buyer') from public.profiles where id = new.sender_id) else c.store_name end;
    perform public.notify(other, 'new_message', jsonb_build_object('name', left(sender_name, 40)), '/messages/' || new.conversation_id);
  end if;
  return new;
end $$;

create or replace function public.job_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; other uuid; title text; sender_name text; had_unread boolean;
begin
  if not new.is_system and (select count(*) from public.job_messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = 'P0001';
  end if;
  select * into t from public.job_threads where id = new.thread_id;
  update public.job_threads set last_message_at = now() where id = new.thread_id;
  if new.is_system then return new; end if;
  other := case when new.sender_id = t.employer_id then t.applicant_id else t.employer_id end;
  select exists (select 1 from public.job_messages where thread_id = new.thread_id and sender_id = new.sender_id and read_at is null and id <> new.id and not is_system) into had_unread;
  if not had_unread then
    select p.title into title from public.job_applications a join public.job_posts p on p.id = a.post_id where a.id = t.application_id;
    select coalesce(display_name, 'Someone') into sender_name from public.profiles where id = new.sender_id;
    perform public.notify(other, 'job_message', jsonb_build_object('name', left(sender_name, 40), 'title', left(title, 60)), '/jobs/messages/' || t.application_id);
  end if;
  return new;
end $$;

/* ───────── Orders → chat ───────── */

create or replace function public.orders_chat_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; sender uuid;
begin
  if new.conversation_id is null then return null; end if;
  if tg_op = 'INSERT' then k := new.status::text;
  elsif new.status is distinct from old.status then
    k := case when old.status = 'payment_submitted' and new.status = 'quoted' then 'payment_rejected' else new.status::text end;
  elsif old.conversation_id is null then k := new.status::text; -- an order request gets its chat linked right after it is created
  else return null;
  end if;
  sender := case
    when k in ('requested', 'payment_submitted', 'completed') then new.buyer_id
    when k in ('quoted', 'paid', 'payment_rejected', 'packed', 'shipped', 'delivered', 'pending_confirmation') then new.seller_id
    when k = 'cancelled' then coalesce(new.cancelled_by, auth.uid(), new.buyer_id)
    else coalesce(auth.uid(), new.buyer_id) end;
  if sender not in (new.buyer_id, new.seller_id) then sender := new.buyer_id; end if;
  insert into public.messages (conversation_id, sender_id, body, is_system, system_kind, system_link)
    values (new.conversation_id, sender, left('Order update (' || k || '): ' || coalesce(new.summary, ''), 500), true, 'order.' || k, '/orders/' || new.id);
  return null;
end $$;
create trigger orders_chat_update after insert or update of status, conversation_id on public.orders
  for each row execute function public.orders_chat_update();

/* ───────── Job applications → chat, and the applicant's hiring confirmation ───────── */

alter table public.job_applications add column applicant_confirmed_at timestamptz;

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
create trigger job_applications_chat_update after insert or update of status, applicant_confirmed_at on public.job_applications
  for each row execute function public.job_applications_chat_update();

-- The applicant confirms they were hired (after the employer marked them hired): a completed job transaction for both.
create or replace function public.confirm_hire(p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a record; title text; owner uuid;
begin
  select * into a from public.job_applications where id = p_app and applicant_id = auth.uid() for update;
  if not found then raise exception 'Application not found'; end if;
  if a.status <> 'hired' then raise exception 'You can confirm only after the employer marks you as hired'; end if;
  if a.applicant_confirmed_at is not null then return; end if;
  update public.job_applications set applicant_confirmed_at = now() where id = p_app;
  select jp.title, jp.owner_id into title, owner from public.job_posts jp where jp.id = a.post_id;
  perform public.notify(owner, 'hire_confirmed', jsonb_build_object('name', public.display_name_of(a.applicant_id), 'title', left(title, 60)), '/jobs/employer/' || a.post_id);
end $$;
revoke all on function public.confirm_hire(uuid) from public, anon;
grant execute on function public.confirm_hire(uuid) to authenticated;

/* ───────── Successful transactions per person ───────── */

create or replace function public.transaction_counts(p_user uuid)
returns table (sold integer, bought integer, hired integer, hires integer)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.orders where seller_id = p_user and status = 'completed')::int,
         (select count(*) from public.orders where buyer_id = p_user and status = 'completed')::int,
         (select count(*) from public.job_applications where applicant_id = p_user and status = 'hired' and applicant_confirmed_at is not null)::int,
         (select count(*) from public.job_applications a join public.job_posts p on p.id = a.post_id
           where p.owner_id = p_user and a.status = 'hired' and a.applicant_confirmed_at is not null)::int;
$$;
