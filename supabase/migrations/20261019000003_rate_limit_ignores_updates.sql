-- The chat speed limit counts only messages people type, not automatic order / job update cards
-- (a busy seller with many orders moving at once must still be able to chat).

create or replace function public.message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  if not new.is_system then
    select count(*) into recent from public.messages
     where sender_id = new.sender_id and not is_system and created_at > now() - interval '1 minute';
    if recent >= 20 then raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = 'P0001'; end if;
  end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

create or replace function public.job_message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; other uuid; title text; sender_name text; had_unread boolean;
begin
  if not new.is_system and (select count(*) from public.job_messages
       where sender_id = new.sender_id and not is_system and created_at > now() - interval '1 minute') >= 20 then
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
