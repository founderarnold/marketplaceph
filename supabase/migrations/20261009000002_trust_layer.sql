-- MarketplacePH — Phase 2: Trust Layer.
-- Verification (private docs), deals + two-way reviews, computed trust metrics + badges,
-- reports → cases with due process (notice, response window, admin review, appeal) → watchlist,
-- notifications. Everything sensitive goes through SECURITY DEFINER functions with explicit checks.

-- ───────────────────────── Shared helpers ─────────────────────────
alter table public.profiles
  add column restricted_until timestamptz,
  add column sheet_public boolean not null default false;

-- Normalise Philippine mobile numbers to +639XXXXXXXXX (null if not a PH mobile).
create or replace function public.normalize_ph_phone(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^09\d{9}$' then '+63' || substr(d, 2)
    when d ~ '^9\d{9}$' then '+63' || d
    when d ~ '^639\d{9}$' then '+' || d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x;
$$;

create or replace function public.assert_not_restricted(p_user uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = p_user and restricted_until > now()) then
    raise exception 'Your account is temporarily restricted. Check your notifications for details.' using errcode = 'P0001';
  end if;
end $$;

-- A restricted account can't post, chat or open deals until the restriction ends.
create or replace function public.restricted_guard_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    perform public.assert_not_restricted((select owner_id from public.stores where id = new.store_id));
  end if;
  return new;
end $$;
create trigger listings_restricted before insert on public.listings
  for each row execute function public.restricted_guard_listing();

create or replace function public.restricted_guard_sender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then perform public.assert_not_restricted(auth.uid()); end if;
  return new;
end $$;
create trigger messages_restricted before insert on public.messages
  for each row execute function public.restricted_guard_sender();
create trigger conversations_restricted before insert on public.conversations
  for each row execute function public.restricted_guard_sender();

-- ───────────────────────── Notifications ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_own on public.notifications for select using (user_id = auth.uid());

-- Internal only: nobody can call this directly from the API.
create or replace function public.notify(p_user uuid, p_kind text, p_params jsonb default '{}', p_link text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, params, link) values (p_user, p_kind, coalesce(p_params, '{}'), p_link);
$$;
revoke all on function public.notify(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- ───────────────────────── Verification ─────────────────────────
create type public.verification_status as enum ('pending', 'approved', 'rejected', 'needs_more');
create type public.verification_doc_type as enum
  ('gov_id', 'selfie_with_id', 'dti', 'sec', 'cda', 'bir_cor', 'mayors_permit', 'fda', 'other');

create table public.store_verifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  target_level smallint not null check (target_level in (2, 3)),
  status public.verification_status not null default 'pending',
  submitted_by uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  reviewer_note text check (char_length(reviewer_note) <= 1000)
);
create unique index store_verifications_one_pending on public.store_verifications (store_id) where status = 'pending';
create index store_verifications_status on public.store_verifications (status, submitted_at);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.store_verifications (id) on delete cascade,
  doc_type public.verification_doc_type not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  -- documents are purged after this date (data minimisation)
  retain_until timestamptz
);
create index verification_documents_ver on public.verification_documents (verification_id);

-- Every time an admin opens a private document (verification or case evidence) it is logged.
create table public.document_access_logs (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('verification', 'evidence')),
  document_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.store_verifications enable row level security;
alter table public.verification_documents enable row level security;
alter table public.document_access_logs enable row level security;

create policy ver_owner_read on public.store_verifications for select using (
  public.is_admin() or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
);
-- Rows are created/changed only through the functions below.
create policy verdocs_admin_read on public.verification_documents for select using (public.is_admin());
create policy verdocs_owner_list on public.verification_documents for select using (
  exists (select 1 from public.store_verifications v join public.stores s on s.id = v.store_id
          where v.id = verification_id and s.owner_id = auth.uid())
);
create policy doclogs_admin_read on public.document_access_logs for select using (public.is_admin());
create policy doclogs_admin_insert on public.document_access_logs for insert with check (public.is_admin() and admin_id = auth.uid());

-- A new store is "phone verified" (level 1) when its owner signed in with a confirmed phone number.
create or replace function public.protect_store_verification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verification_level = case when exists (
        select 1 from auth.users u where u.id = new.owner_id and u.phone_confirmed_at is not null
      ) then 1 else 0 end;
    elsif new.verification_level is distinct from old.verification_level then
      raise exception 'Only admins can change verification level';
    end if;
  end if;
  return new;
end $$;

-- p_docs: [{"type":"gov_id","path":"<uid>/..."}]
create or replace function public.submit_verification(p_store uuid, p_target smallint, p_docs jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare s record; ver uuid; d jsonb; types text[];
begin
  select * into s from public.stores where id = p_store and owner_id = auth.uid();
  if not found then raise exception 'Not your store'; end if;
  if p_target not in (2, 3) then raise exception 'Invalid level'; end if;
  if s.verification_level >= p_target then raise exception 'Already at this level'; end if;
  if p_target = 3 and s.verification_level < 2 then raise exception 'Get ID verified first'; end if;
  if jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) not between 1 and 8 then raise exception 'Attach your documents'; end if;
  select array_agg(x ->> 'type') into types from jsonb_array_elements(p_docs) x;
  if p_target = 2 and not (types @> array['gov_id', 'selfie_with_id']) then
    raise exception 'ID verification needs a government ID and a selfie holding it';
  end if;
  if p_target = 3 and not (types @> array['bir_cor', 'mayors_permit'] and (types && array['dti', 'sec', 'cda'])) then
    raise exception 'Business verification needs DTI/SEC/CDA registration, BIR COR and Mayor''s permit';
  end if;
  for d in select * from jsonb_array_elements(p_docs) loop
    if (d ->> 'path') not like auth.uid()::text || '/%' then raise exception 'Invalid document path'; end if;
  end loop;

  insert into public.store_verifications (store_id, target_level, submitted_by) values (p_store, p_target, auth.uid()) returning id into ver;
  insert into public.verification_documents (verification_id, doc_type, storage_path)
    select ver, (x ->> 'type')::public.verification_doc_type, x ->> 'path' from jsonb_array_elements(p_docs) x;
  return ver;
end $$;
revoke all on function public.submit_verification(uuid, smallint, jsonb) from public, anon;
grant execute on function public.submit_verification(uuid, smallint, jsonb) to authenticated;

create or replace function public.review_verification(p_id uuid, p_decision public.verification_status, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare v record; v_owner uuid;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_decision = 'pending' then raise exception 'Invalid decision'; end if;
  select * into v from public.store_verifications where id = p_id and status = 'pending';
  if not found then raise exception 'Not pending'; end if;
  update public.store_verifications
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(), reviewer_note = nullif(trim(p_note), '')
   where id = p_id;
  select owner_id into v_owner from public.stores where id = v.store_id;
  if p_decision = 'approved' then
    update public.stores set verification_level = greatest(verification_level, v.target_level) where id = v.store_id;
    -- minimise what we keep: documents are deleted 90 days after approval
    update public.verification_documents set retain_until = now() + interval '90 days' where verification_id = p_id;
  else
    update public.verification_documents set retain_until = now() + interval '30 days' where verification_id = p_id;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'VERIFICATION_' || upper(p_decision::text), 'store_verifications', p_id::text, jsonb_build_object('store', v.store_id, 'level', v.target_level));
  perform public.notify(v_owner, 'verification_' || p_decision::text, jsonb_build_object('level', v.target_level, 'note', nullif(trim(p_note), '')), '/sell/verify');
end $$;
revoke all on function public.review_verification(uuid, public.verification_status, text) from public, anon;
grant execute on function public.review_verification(uuid, public.verification_status, text) to authenticated;

-- Private upload buckets: users can only ADD files under their own folder; nobody can list/read them
-- through the API. Admins read via server-signed URLs (each one logged in document_access_logs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('review-images', 'review-images', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "own upload private docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own upload evidence" on storage.objects for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public read review images" on storage.objects for select using (bucket_id = 'review-images');
create policy "own upload review images" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Deals (minimal orders) + reviews ─────────────────────────
-- Phase 3 grows this into the full order flow (payment proof, packing, shipping). For Phase 2 a deal is:
-- seller records it from a chat → buyer confirms → "completed". Only completed deals unlock reviews/metrics.
create type public.order_status as enum ('pending_confirmation', 'completed', 'cancelled', 'disputed');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  summary text not null check (char_length(summary) between 3 and 200),
  quantity integer not null check (quantity >= 1),
  amount numeric(14, 2) not null check (amount >= 0),
  status public.order_status not null default 'pending_confirmation',
  confirmed_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index orders_store on public.orders (store_id, status);
create index orders_buyer on public.orders (buyer_id, status);
create index orders_seller on public.orders (seller_id, status);

create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); recent int; pending int;
begin
  if tg_op = 'INSERT' then
    new.seller_id := (select owner_id from public.stores where id = new.store_id);
    if uid is not null then
      perform public.assert_not_restricted(uid);
      new.status := 'pending_confirmation'; new.confirmed_at := null; new.cancelled_by := null;
      select count(*) into recent from public.orders where seller_id = uid and created_at > now() - interval '1 day';
      if recent >= 30 then raise exception 'Daily deal limit reached' using errcode = 'P0001'; end if;
      select count(*) into pending from public.orders where seller_id = uid and buyer_id = new.buyer_id and status = 'pending_confirmation';
      if pending >= 3 then raise exception 'Too many unconfirmed deals with this buyer' using errcode = 'P0001'; end if;
    end if;
    return new;
  end if;

  if uid is null or public.is_admin() then return new; end if;
  if (new.store_id, new.seller_id, new.buyer_id, new.summary, new.quantity, new.amount, new.conversation_id, new.listing_id, new.created_at)
     is distinct from (old.store_id, old.seller_id, old.buyer_id, old.summary, old.quantity, old.amount, old.conversation_id, old.listing_id, old.created_at) then
    raise exception 'Deal details cannot be edited';
  end if;
  if old.status <> 'pending_confirmation' then raise exception 'This deal is already closed'; end if;
  if new.status = 'completed' then
    if uid <> old.buyer_id then raise exception 'Only the buyer can confirm a deal'; end if;
    new.confirmed_at := now();
  elsif new.status = 'cancelled' then
    new.cancelled_by := uid;
  else
    raise exception 'Invalid status change';
  end if;
  return new;
end $$;
create trigger orders_guard_t before insert or update on public.orders
  for each row execute function public.orders_guard();

create or replace function public.orders_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.buyer_id, 'deal_proposed', jsonb_build_object('summary', new.summary), '/orders');
  elsif new.status is distinct from old.status then
    if new.status = 'completed' then perform public.notify(new.seller_id, 'deal_confirmed', jsonb_build_object('summary', new.summary), '/orders');
    elsif new.status = 'cancelled' then
      perform public.notify(case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end, 'deal_cancelled', jsonb_build_object('summary', new.summary), '/orders');
    end if;
  end if;
  return new;
end $$;
create trigger orders_notify_t after insert or update on public.orders
  for each row execute function public.orders_notify();

alter table public.orders enable row level security;
create policy orders_read on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
-- A deal can only be recorded between two people who have actually talked in a chat for that store.
create policy orders_insert on public.orders for insert with check (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.store_id = orders.store_id and c.buyer_id = orders.buyer_id)
  and exists (select 1 from public.messages m where m.conversation_id = orders.conversation_id and m.sender_id = orders.buyer_id)
);
create policy orders_update on public.orders for update using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  direction text not null check (direction in ('buyer_to_seller', 'seller_to_buyer')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  created_at timestamptz not null default now(),
  unique (order_id, reviewer_id)
);
create index reviews_store on public.reviews (store_id, direction, created_at desc);
create index reviews_reviewee on public.reviews (reviewee_id, direction);

create or replace function public.reviews_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = new.order_id;
  if not found or o.status <> 'completed' then raise exception 'You can only review a completed deal'; end if;
  if auth.uid() is not null and now() > o.confirmed_at + interval '60 days' then raise exception 'The review window for this deal has closed'; end if;
  if new.reviewer_id = o.buyer_id then
    new.direction := 'buyer_to_seller'; new.reviewee_id := o.seller_id;
  elsif new.reviewer_id = o.seller_id then
    new.direction := 'seller_to_buyer'; new.reviewee_id := o.buyer_id;
  else raise exception 'You were not part of this deal'; end if;
  new.store_id := o.store_id;
  return new;
end $$;
create trigger reviews_guard_t before insert on public.reviews
  for each row execute function public.reviews_guard();

create or replace function public.reviews_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.reviewee_id, 'review_received', jsonb_build_object('rating', new.rating), case when new.direction = 'buyer_to_seller' then '/my/listings' else '/orders' end);
  return new;
end $$;
create trigger reviews_notify_t after insert on public.reviews
  for each row execute function public.reviews_notify();

alter table public.reviews enable row level security;
create policy reviews_read on public.reviews for select using (true);
create policy reviews_insert on public.reviews for insert with check (reviewer_id = auth.uid());
create policy reviews_admin_delete on public.reviews for delete using (public.is_admin());
create trigger audit_reviews after delete on public.reviews for each row execute function public.log_admin_change();
create trigger audit_orders after update on public.orders for each row execute function public.log_admin_change();

-- ───────────────────────── Trust metrics (computed, never stored) ─────────────────────────
create or replace function public.amount_range(n numeric) returns text
language sql immutable as $$
  select case
    when n is null or n <= 0 then '₱0'
    when n < 10000 then 'Under ₱10K'
    when n < 50000 then '₱10K–50K'
    when n < 100000 then '₱50K–100K'
    when n < 500000 then '₱100K–500K'
    when n < 1000000 then '₱500K–1M'
    when n < 5000000 then '₱1M–5M'
    else '₱5M+' end;
$$;

create or replace function public.store_trust(p_store uuid)
returns table (
  completed_orders integer, amount_label text, total_quantity bigint,
  avg_rating numeric, review_count integer,
  response_rate numeric, response_sample integer,
  dispute_rate numeric, member_since timestamptz
) language sql stable security definer set search_path = public as $$
  with o as (
    select count(*) filter (where status = 'completed') as done,
           coalesce(sum(amount) filter (where status = 'completed'), 0) as amt,
           coalesce(sum(quantity) filter (where status = 'completed'), 0) as qty,
           count(*) filter (where status = 'disputed') as disputed
      from public.orders where store_id = p_store),
  r as (select count(*) as n, avg(rating) as a from public.reviews where store_id = p_store and direction = 'buyer_to_seller'),
  conv as (
    select c.id, (select min(m.created_at) from public.messages m where m.conversation_id = c.id and m.sender_id = c.buyer_id) as first_buyer
      from public.conversations c where c.store_id = p_store and c.created_at > now() - interval '90 days'),
  resp as (
    select count(*) filter (where first_buyer is not null) as total,
           count(*) filter (where first_buyer is not null and exists (
             select 1 from public.messages m join public.stores st on st.id = p_store
              where m.conversation_id = conv.id and m.sender_id = st.owner_id
                and m.created_at >= conv.first_buyer and m.created_at <= conv.first_buyer + interval '24 hours')) as replied
      from conv)
  select o.done::int, public.amount_range(o.amt), o.qty,
         round(r.a, 2), r.n::int,
         case when resp.total > 0 then round(resp.replied::numeric / resp.total, 2) end, resp.total::int,
         case when o.done + o.disputed > 0 then round(o.disputed::numeric / (o.done + o.disputed), 3) end,
         (select created_at from public.stores where id = p_store)
    from o, r, resp;
$$;

create or replace function public.user_trust(p_user uuid)
returns table (
  completed_orders integer, amount_label text, cancellation_rate numeric,
  avg_rating numeric, review_count integer,
  payment_reliability numeric, member_since timestamptz
) language sql stable security definer set search_path = public as $$
  with o as (
    select count(*) filter (where status = 'completed') as done,
           coalesce(sum(amount) filter (where status = 'completed'), 0) as amt,
           count(*) filter (where status = 'cancelled' and cancelled_by = p_user) as cancelled
      from public.orders where buyer_id = p_user),
  r as (select count(*) as n, avg(rating) as a from public.reviews where reviewee_id = p_user and direction = 'seller_to_buyer')
  select o.done::int, public.amount_range(o.amt),
         case when o.done + o.cancelled > 0 then round(o.cancelled::numeric / (o.done + o.cancelled), 3) end,
         round(r.a, 2), r.n::int,
         null::numeric, -- payment reliability needs payment proofs (Phase 3)
         (select created_at from public.profiles where id = p_user)
    from o, r;
$$;

create table public.badges (
  code text primary key,
  kind text not null check (kind in ('store', 'buyer')),
  name_en text not null, name_fil text not null,
  description_en text not null, description_fil text not null
);
alter table public.badges enable row level security;
create policy badges_read on public.badges for select using (true);
insert into public.badges values
  ('fast_responder', 'store', 'Fast Responder', 'Mabilis Sumagot', 'Replies to most new chats within 24 hours.', 'Sumasagot sa karamihan ng bagong chat sa loob ng 24 oras.'),
  ('top_seller', 'store', 'Top Seller', 'Top Seller', '20+ completed deals, 4.5+ average rating and very few disputes.', '20+ natapos na deal, 4.5+ na rating at halos walang dispute.'),
  ('reliable_buyer', 'buyer', 'Reliable Buyer', 'Maaasahang Buyer', '5+ completed deals with very few cancellations.', '5+ natapos na deal at halos walang kinansela.');

-- Badges are derived from live data so they can never go stale.
create or replace function public.store_badges(p_store uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_remove(array[
    case when t.response_sample >= 5 and t.response_rate >= 0.8 then 'fast_responder' end,
    case when t.completed_orders >= 20 and t.review_count >= 10 and t.avg_rating >= 4.5 and coalesce(t.dispute_rate, 0) < 0.05 then 'top_seller' end
  ], null), '{}') from public.store_trust(p_store) t;
$$;
create or replace function public.buyer_badges(p_user uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_remove(array[
    case when t.completed_orders >= 5 and coalesce(t.cancellation_rate, 0) < 0.1 and coalesce(t.avg_rating, 5) >= 4 then 'reliable_buyer' end
  ], null), '{}') from public.user_trust(p_user) t;
$$;
grant execute on function public.amount_range(numeric), public.store_trust(uuid), public.user_trust(uuid),
  public.store_badges(uuid), public.buyer_badges(uuid), public.normalize_ph_phone(text) to anon, authenticated;

-- Buyer information sheet: public only if the buyer opted in; also visible to people the buyer chats with, and to admins.
create or replace function public.buyer_sheet(p_user uuid)
returns table (display_name text, avatar_url text, trust_completed integer, trust_amount text, cancellation_rate numeric,
               avg_rating numeric, review_count integer, member_since timestamptz, badges text[])
language plpgsql stable security definer set search_path = public as $$
declare allowed boolean;
begin
  select (p.sheet_public or p.id = auth.uid() or public.is_admin()
          or exists (select 1 from public.conversations c join public.stores s on s.id = c.store_id
                      where (c.buyer_id = p_user and s.owner_id = auth.uid()) or (c.buyer_id = auth.uid() and s.owner_id = p_user)))
    into allowed from public.profiles p where p.id = p_user;
  if not coalesce(allowed, false) then return; end if;
  return query
    select p.display_name, p.avatar_url, t.completed_orders, t.amount_label, t.cancellation_rate, t.avg_rating, t.review_count,
           t.member_since, public.buyer_badges(p_user)
      from public.profiles p, public.user_trust(p_user) t where p.id = p_user;
end $$;
grant execute on function public.buyer_sheet(uuid) to anon, authenticated;

-- ───────────────────────── Reports → cases (due process) ─────────────────────────
alter table public.reports
  add column accused_id uuid references public.profiles (id) on delete set null,
  add column accused_store_id uuid references public.stores (id) on delete set null,
  add column response_due_at timestamptz,
  add column decided_at timestamptz,
  add column decided_by uuid references public.profiles (id),
  add column decision_note text check (char_length(decision_note) <= 1000);  -- shown to the accused (admin_note stays internal)

-- Work out who the report is about, and refuse duplicates and self-reports.
create or replace function public.report_resolve_target() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.target_type = 'listing' then
    select s.owner_id, s.id into new.accused_id, new.accused_store_id from public.listings l join public.stores s on s.id = l.store_id where l.id = new.target_id;
  elsif new.target_type = 'store' then
    select owner_id, id into new.accused_id, new.accused_store_id from public.stores where id = new.target_id;
  elsif new.target_type = 'user' then
    new.accused_id := new.target_id;
  elsif new.target_type = 'message' then
    select sender_id into new.accused_id from public.messages where id = new.target_id;
  end if;
  if new.accused_id is null then raise exception 'That item no longer exists'; end if;
  if new.accused_id = new.reporter_id then raise exception 'You cannot report yourself'; end if;
  if exists (select 1 from public.reports r where r.reporter_id = new.reporter_id and r.target_type = new.target_type and r.target_id = new.target_id
              and r.status in ('open', 'awaiting_response', 'under_review')) then
    raise exception 'You already have an open report about this' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reports_resolve before insert on public.reports
  for each row execute function public.report_resolve_target();

-- Admins/moderators only change cases through the functions below (not by raw UPDATE).
drop policy reports_admin_update on public.reports;

create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  note text check (char_length(note) <= 300),
  -- Admin decides whether the accused may see this file (reporters' personal info may be in screenshots).
  shareable boolean not null default false,
  created_at timestamptz not null default now()
);
create index report_evidence_report on public.report_evidence (report_id);

create table public.report_responses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 5 and 3000),
  evidence_paths text[] not null default '{}' check (cardinality(evidence_paths) <= 4),
  created_at timestamptz not null default now()
);

create table public.watchlist_entries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  subject_user_id uuid references public.profiles (id) on delete set null,
  subject_store_id uuid references public.stores (id) on delete set null,
  -- Identifiers people can check before paying. Matched EXACTLY (no browsing/enumeration).
  phone text,                 -- +639XXXXXXXXX
  gcash_name text,
  store_name text,
  store_slug text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  flagged_at timestamptz not null default now(),
  expires_at timestamptz not null,
  review_on timestamptz not null
);
create index watchlist_phone on public.watchlist_entries (phone) where status = 'active';
create index watchlist_gcash on public.watchlist_entries (lower(gcash_name)) where status = 'active';
create index watchlist_store on public.watchlist_entries (store_slug) where status = 'active';

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports (id) on delete cascade,
  appellant_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending', 'upheld', 'overturned')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  decision_note text check (char_length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.report_evidence enable row level security;
alter table public.report_responses enable row level security;
alter table public.watchlist_entries enable row level security;
alter table public.appeals enable row level security;

create policy evidence_read on public.report_evidence for select using (uploader_id = auth.uid() or public.is_admin());
create policy evidence_insert on public.report_evidence for insert with check (
  uploader_id = auth.uid() and exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = auth.uid())
);
create policy responses_read on public.report_responses for select using (public.is_admin());
create policy watchlist_admin on public.watchlist_entries for select using (public.is_admin());   -- public access is via check_before_pay() only
create policy appeals_read on public.appeals for select using (appellant_id = auth.uid() or public.is_admin());

-- 1. Admin opens a case: the accused is notified and gets a response window.
create or replace function public.open_case(p_report uuid, p_days integer default 7) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_days not between 3 and 30 then raise exception 'Response window must be 3 to 30 days'; end if;
  select * into r from public.reports where id = p_report and status in ('open', 'under_review', 'reviewing');
  if not found then raise exception 'Report is not awaiting review'; end if;
  update public.reports set status = 'awaiting_response', response_due_at = now() + make_interval(days => p_days) where id = p_report;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'CASE_OPENED', 'reports', p_report::text, jsonb_build_object('days', p_days));
  perform public.notify(r.accused_id, 'case_opened', jsonb_build_object('reason', r.reason, 'days', p_days), '/my/cases');
end $$;

-- 2. The accused answers (once), inside the window.
create or replace function public.submit_case_response(p_report uuid, p_body text, p_paths text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.reports where id = p_report and accused_id = auth.uid();
  if not found then raise exception 'Case not found'; end if;
  if r.status <> 'awaiting_response' then raise exception 'This case is not open for responses'; end if;
  if now() > r.response_due_at then raise exception 'The response window has closed'; end if;
  if exists (select 1 from public.report_responses where report_id = p_report) then raise exception 'You already responded'; end if;
  if exists (select 1 from unnest(p_paths) x where x not like auth.uid()::text || '/%') then raise exception 'Invalid file path'; end if;
  insert into public.report_responses (report_id, responder_id, body, evidence_paths) values (p_report, auth.uid(), p_body, p_paths);
end $$;

-- 3. Admin decides. Only after the accused responded OR the window passed (except dismissing a baseless report).
-- Public flags need role = admin (moderators can recommend, not publish).
create or replace function public.decide_case(
  p_report uuid, p_outcome text, p_note text,
  p_restrict_days integer default null, p_gcash_name text default null, p_flag_months integer default 12
) returns void
language plpgsql security definer set search_path = public as $$
declare r record; me record; has_resp boolean; subj record; appeal_by timestamptz;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.role not in ('admin', 'moderator') then raise exception 'Admins only'; end if;
  if p_outcome not in ('dismissed', 'warning', 'restricted', 'flagged') then raise exception 'Invalid outcome'; end if;
  if p_outcome = 'flagged' and me.role <> 'admin' then raise exception 'Only an admin can publish a flag'; end if;
  select * into r from public.reports where id = p_report and status in ('open', 'under_review', 'reviewing', 'awaiting_response');
  if not found then raise exception 'Case already decided'; end if;

  if p_outcome <> 'dismissed' then
    if r.status <> 'awaiting_response' then raise exception 'Open the case and give the user a chance to respond first'; end if;
    select exists (select 1 from public.report_responses where report_id = p_report) into has_resp;
    if not has_resp and now() < r.response_due_at then raise exception 'The response window is still open'; end if;
    if nullif(trim(p_note), '') is null then raise exception 'A decision note for the user is required'; end if;
  end if;

  update public.reports set status = p_outcome::public.report_status, decided_at = now(), decided_by = auth.uid(), decision_note = nullif(trim(p_note), '') where id = p_report;
  appeal_by := now() + interval '30 days';

  if p_outcome = 'restricted' then
    update public.profiles set restricted_until = now() + make_interval(days => coalesce(p_restrict_days, 7)) where id = r.accused_id;
  elsif p_outcome = 'flagged' then
    select p.phone as p_phone, s.contact_phone, s.name, s.slug into subj
      from public.profiles p left join public.stores s on s.id = r.accused_store_id where p.id = r.accused_id;
    insert into public.watchlist_entries (report_id, subject_user_id, subject_store_id, phone, gcash_name, store_name, store_slug, expires_at, review_on)
    values (p_report, r.accused_id, r.accused_store_id,
            coalesce(public.normalize_ph_phone(subj.p_phone), public.normalize_ph_phone(subj.contact_phone)),
            nullif(trim(p_gcash_name), ''), subj.name, subj.slug,
            now() + make_interval(months => p_flag_months), now() + make_interval(months => greatest(1, p_flag_months / 2)));
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'CASE_' || upper(p_outcome), 'reports', p_report::text, jsonb_build_object('accused', r.accused_id));
  if p_outcome <> 'dismissed' then
    perform public.notify(r.accused_id, 'case_decided', jsonb_build_object('outcome', p_outcome, 'note', p_note, 'appeal_by', appeal_by), '/my/cases');
  end if;
  perform public.notify(r.reporter_id, 'report_closed', '{}', '/my/cases');
end $$;

-- 4. The accused can appeal within 30 days of the decision.
create or replace function public.file_appeal(p_report uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.reports where id = p_report and accused_id = auth.uid();
  if not found then raise exception 'Case not found'; end if;
  if r.status not in ('warning', 'restricted', 'flagged') then raise exception 'There is nothing to appeal'; end if;
  if now() > r.decided_at + interval '30 days' then raise exception 'The appeal period has ended'; end if;
  insert into public.appeals (report_id, appellant_id, body) values (p_report, auth.uid(), p_body);
end $$;

create or replace function public.decide_appeal(p_appeal uuid, p_outcome text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare a record; r record;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Only an admin can decide appeals'; end if;
  if p_outcome not in ('upheld', 'overturned') then raise exception 'Invalid outcome'; end if;
  select * into a from public.appeals where id = p_appeal and status = 'pending';
  if not found then raise exception 'Appeal not pending'; end if;
  select * into r from public.reports where id = a.report_id;
  -- a different admin should review where possible
  if r.decided_by = auth.uid() and exists (select 1 from public.profiles where role = 'admin' and id <> auth.uid()) then
    raise exception 'A different admin must review this appeal';
  end if;
  update public.appeals set status = p_outcome, reviewed_by = auth.uid(), reviewed_at = now(), decision_note = nullif(trim(p_note), '') where id = p_appeal;
  if p_outcome = 'overturned' then
    update public.watchlist_entries set status = 'revoked' where report_id = a.report_id;
    if r.status = 'restricted' then update public.profiles set restricted_until = null where id = r.accused_id; end if;
    update public.reports set status = 'dismissed', admin_note = coalesce(admin_note || E'\n', '') || 'Overturned on appeal.' where id = a.report_id;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'APPEAL_' || upper(p_outcome), 'appeals', p_appeal::text, jsonb_build_object('report', a.report_id));
  perform public.notify(a.appellant_id, 'appeal_decided', jsonb_build_object('outcome', p_outcome, 'note', p_note), '/my/cases');
end $$;

-- Admin curates what the accused may see.
create or replace function public.set_evidence_shareable(p_evidence uuid, p_shareable boolean) returns void
language sql security definer set search_path = public as $$
  update public.report_evidence set shareable = p_shareable where id = p_evidence and public.is_admin();
$$;

-- What the accused sees about reports against them: the allegation + decision, never who reported.
create or replace function public.cases_about_me()
returns table (report_id uuid, target_type public.report_target, reason text, details text, status public.report_status,
               response_due_at timestamptz, decided_at timestamptz, decision_note text, created_at timestamptz,
               has_response boolean, appeal_status text, appeal_by timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.target_type, r.reason, r.details, r.status, r.response_due_at, r.decided_at, r.decision_note, r.created_at,
         exists (select 1 from public.report_responses x where x.report_id = r.id),
         (select a.status from public.appeals a where a.report_id = r.id),
         case when r.decided_at is not null then r.decided_at + interval '30 days' end
    from public.reports r
   where r.accused_id = auth.uid() and r.status not in ('open', 'under_review', 'reviewing', 'dismissed')
   order by r.created_at desc;
$$;

create or replace function public.evidence_shared_with_me(p_report uuid) returns table (id uuid, note text, storage_path text)
language sql stable security definer set search_path = public as $$
  select e.id, e.note, e.storage_path from public.report_evidence e join public.reports r on r.id = e.report_id
   where e.report_id = p_report and e.shareable and r.accused_id = auth.uid() and r.status <> 'open';
$$;

-- "Check muna bago bayad": EXACT match on phone, GCash name, store name or store link name. Returns only
-- admin-confirmed, still-active flags, with no allegation details.
create or replace function public.check_before_pay(p_query text)
returns table (match_kind text, label text, flagged_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_query, ''))); ph text := public.normalize_ph_phone(p_query);
begin
  if char_length(q) < 4 then return; end if;
  return query
    select case when w.phone is not null and w.phone = ph then 'phone'
                when lower(w.gcash_name) = q then 'gcash_name'
                else 'store' end,
           coalesce(w.store_name, w.gcash_name, 'Seller'), w.flagged_at, w.expires_at
      from public.watchlist_entries w
     where w.status = 'active' and w.expires_at > now()
       and ((ph is not null and w.phone = ph) or lower(w.gcash_name) = q or lower(w.store_name) = q or w.store_slug = q);
end $$;
grant execute on function public.check_before_pay(text) to anon, authenticated;

create or replace function public.store_flag(p_store uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(flagged_at) from public.watchlist_entries where subject_store_id = p_store and status = 'active' and expires_at > now();
$$;
grant execute on function public.store_flag(uuid) to anon, authenticated;

-- Lock down: workflow functions are for signed-in users only.
revoke all on function public.open_case(uuid, integer), public.submit_case_response(uuid, text, text[]),
  public.decide_case(uuid, text, text, integer, text, integer), public.file_appeal(uuid, text),
  public.decide_appeal(uuid, text, text), public.set_evidence_shareable(uuid, boolean),
  public.cases_about_me(), public.evidence_shared_with_me(uuid), public.assert_not_restricted(uuid) from public, anon;
grant execute on function public.open_case(uuid, integer), public.submit_case_response(uuid, text, text[]),
  public.decide_case(uuid, text, text, integer, text, integer), public.file_appeal(uuid, text),
  public.decide_appeal(uuid, text, text), public.set_evidence_shareable(uuid, boolean),
  public.cases_about_me(), public.evidence_shared_with_me(uuid) to authenticated;

-- Audit more admin-touched tables
create trigger audit_watchlist after insert or update on public.watchlist_entries for each row execute function public.log_admin_change();
create trigger audit_appeals after update on public.appeals for each row execute function public.log_admin_change();
