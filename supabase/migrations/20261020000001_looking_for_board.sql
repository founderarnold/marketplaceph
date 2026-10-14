-- "Looking for" board: buyers post what they need (request for quotation); sellers answer with private offers;
-- the buyer accepts one, which opens a chat with that seller to finish the deal. New tables only.

create table public.buy_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'product' check (kind in ('product', 'service')),
  title text not null check (char_length(title) between 5 and 120),
  details text check (char_length(details) <= 2000),
  category_id uuid references public.categories (id) on delete set null,
  quantity numeric(12, 2) check (quantity is null or quantity > 0),
  unit text check (char_length(unit) <= 20),
  budget_min numeric(14, 2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14, 2) check (budget_max is null or budget_max >= 0),
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  needed_by date,
  status text not null default 'open' check (status in ('open', 'closed', 'fulfilled')),
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  check (budget_max is null or budget_min is null or budget_max >= budget_min)
);
create index buy_requests_open on public.buy_requests (created_at desc) where status = 'open';
create index buy_requests_buyer on public.buy_requests (buyer_id, created_at desc);
create index buy_requests_category on public.buy_requests (category_id) where status = 'open';
create index buy_requests_title_trgm on public.buy_requests using gin (title gin_trgm_ops);
alter table public.buy_requests enable row level security;
create policy buy_requests_read on public.buy_requests for select using (true);
create policy buy_requests_insert on public.buy_requests for insert with check (buyer_id = auth.uid() and status = 'open');
create policy buy_requests_update on public.buy_requests for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy buy_requests_delete on public.buy_requests for delete using (buyer_id = auth.uid() or public.is_admin());

create or replace function public.buy_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_not_restricted(new.buyer_id);
    if (select count(*) from public.buy_requests where buyer_id = new.buyer_id and created_at > now() - interval '1 day') >= 10 then
      raise exception 'Daily request limit reached (10)' using errcode = 'P0001';
    end if;
  else
    -- the owner may edit details and open / close it, but not move it to someone else or reset its age
    new.buyer_id := old.buyer_id;
    new.created_at := old.created_at;
    if new.status = 'open' and old.status <> 'open' then new.expires_at := greatest(old.expires_at, now() + interval '30 days'); end if;
  end if;
  perform public.assert_clean_text(new.title || ' ' || coalesce(new.details, ''));
  return new;
end $$;
create trigger buy_requests_guard before insert or update on public.buy_requests for each row execute function public.buy_requests_guard();

create table public.buy_request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buy_requests (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  unit_price numeric(14, 2) check (unit_price is null or unit_price >= 0),
  quantity numeric(12, 2) check (quantity is null or quantity > 0),
  delivery_days integer check (delivery_days is null or delivery_days between 0 and 365),
  message text not null check (char_length(message) between 5 and 1000),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (request_id, store_id)
);
create index buy_request_offers_request on public.buy_request_offers (request_id, created_at);
create index buy_request_offers_seller on public.buy_request_offers (seller_id, created_at desc);
alter table public.buy_request_offers enable row level security;
-- Offers are private: only the buyer who posted the request and the seller who made the offer can see them.
create policy offers_read on public.buy_request_offers for select using (
  seller_id = auth.uid() or exists (select 1 from public.buy_requests r where r.id = request_id and r.buyer_id = auth.uid()) or public.is_admin()
);
create policy offers_insert on public.buy_request_offers for insert with check (seller_id = auth.uid() and status = 'sent');
-- Sellers may only edit or withdraw their own offer (decisions go through respond_to_offer()).
create policy offers_update on public.buy_request_offers for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

create or replace function public.offers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.buy_requests where id = new.request_id;
  if not found then raise exception 'Request not found'; end if;
  if tg_op = 'INSERT' then
    perform public.assert_not_restricted(new.seller_id);
    if r.status <> 'open' or r.expires_at < now() then raise exception 'This request is no longer taking offers'; end if;
    if r.buyer_id = new.seller_id then raise exception 'You cannot send an offer to your own request'; end if;
    if not exists (select 1 from public.stores s where s.id = new.store_id and s.owner_id = new.seller_id) then
      raise exception 'Set up your store first to send offers';
    end if;
    if (select count(*) from public.buy_request_offers where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 50 then
      raise exception 'Daily offer limit reached' using errcode = 'P0001';
    end if;
    perform public.notify(r.buyer_id, 'new_offer', jsonb_build_object('name', (select name from public.stores where id = new.store_id), 'title', left(r.title, 60)), '/looking-for/' || r.id);
  else
    -- sellers can update the terms while the offer is still pending, or withdraw it; nothing else
    if current_setting('app.offer_fn', true) is distinct from '1' then
      if old.status <> 'sent' then raise exception 'This offer was already answered'; end if;
      if new.status not in ('sent', 'withdrawn') then raise exception 'Invalid offer status'; end if;
      new.request_id := old.request_id; new.seller_id := old.seller_id; new.store_id := old.store_id;
      new.conversation_id := old.conversation_id; new.created_at := old.created_at;
    end if;
  end if;
  if new.listing_id is not null and not exists (select 1 from public.listings l where l.id = new.listing_id and l.store_id = new.store_id) then
    raise exception 'You can only link your own listing';
  end if;
  perform public.assert_clean_text(new.message);
  return new;
end $$;
create trigger offers_guard before insert or update on public.buy_request_offers for each row execute function public.offers_guard();

-- The buyer accepts or declines an offer. Accepting opens (or reuses) a chat with that store and posts an update card.
create or replace function public.respond_to_offer(p_offer uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare o record; r record; convo uuid;
begin
  select * into o from public.buy_request_offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into r from public.buy_requests where id = o.request_id;
  if r.buyer_id is distinct from auth.uid() then raise exception 'Offer not found'; end if;
  if o.status <> 'sent' then raise exception 'This offer was already answered'; end if;
  perform set_config('app.offer_fn', '1', true);
  if not p_accept then
    update public.buy_request_offers set status = 'declined' where id = p_offer;
    perform public.notify(o.seller_id, 'offer_declined', jsonb_build_object('title', left(r.title, 60)), '/looking-for/' || r.id);
    return null;
  end if;
  select id into convo from public.conversations where buyer_id = r.buyer_id and store_id = o.store_id and listing_id is not distinct from o.listing_id;
  if convo is null then
    insert into public.conversations (buyer_id, store_id, listing_id) values (r.buyer_id, o.store_id, o.listing_id) returning id into convo;
  end if;
  update public.buy_request_offers set status = 'accepted', conversation_id = convo where id = p_offer;
  insert into public.messages (conversation_id, sender_id, body, is_system, system_kind, system_link)
    values (convo, r.buyer_id, left('Offer accepted: ' || r.title, 500), true, 'request.accepted', '/looking-for/' || r.id);
  perform public.notify(o.seller_id, 'offer_accepted', jsonb_build_object('title', left(r.title, 60)), '/messages/' || convo);
  return convo;
end $$;
revoke all on function public.respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;

-- How many offers a request has (offers themselves stay private).
create or replace function public.request_offer_counts(p_ids uuid[])
returns table (request_id uuid, offers integer)
language sql stable security definer set search_path = public as $$
  select o.request_id, count(*)::int from public.buy_request_offers o
   where o.request_id = any (p_ids) and o.status <> 'withdrawn' group by o.request_id;
$$;
