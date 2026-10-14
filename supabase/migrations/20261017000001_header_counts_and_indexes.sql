-- Scale: the header's badge counts ran on every signed-in page view as six separate queries, and the unread-message
-- counts had to scan EVERY message on the site (RLS checks each row with is_conversation_participant()). That is fine
-- with demo data and falls over with millions of messages. This adds partial indexes for "unread" rows and one
-- function that returns all header numbers in a single round trip, walking only the caller's own conversations.

create index if not exists messages_unread on public.messages (conversation_id) where read_at is null;
create index if not exists job_messages_unread on public.job_messages (thread_id) where read_at is null;
create index if not exists notifications_unread on public.notifications (user_id) where read_at is null;

create or replace function public.my_header_counts()
returns table (notifications integer, cart integer, messages integer, role text, tier integer)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  convs as (
    select c.id from public.conversations c, me where c.buyer_id = me.id
    union
    select c.id from public.conversations c join public.stores s on s.id = c.store_id, me where s.owner_id = me.id
  ),
  threads as (
    select t.id from public.job_threads t, me where t.employer_id = me.id
    union
    select t.id from public.job_threads t, me where t.applicant_id = me.id
  )
  select
    (select count(*) from public.notifications n, me where n.user_id = me.id and n.read_at is null)::int,
    (select count(*) from public.cart_items ci, me where ci.user_id = me.id)::int,
    ((select count(*) from public.messages m, me where m.conversation_id in (select id from convs) and m.read_at is null and m.sender_id <> me.id)
     + (select count(*) from public.job_messages j, me where j.thread_id in (select id from threads) and j.read_at is null and j.sender_id <> me.id))::int,
    (select p.role from public.profiles p, me where p.id = me.id),
    public._tier_rank((select id from me))
  where auth.uid() is not null;
$$;

revoke all on function public.my_header_counts() from public, anon;
grant execute on function public.my_header_counts() to authenticated;
