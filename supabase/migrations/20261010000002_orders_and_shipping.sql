-- MarketplacePH — Phase 3: Orders & Transactions.
-- Cart → order request → seller quote (final price + shipping) → buyer pays directly + uploads proof →
-- seller confirms receipt → packing checklist + photo proof → shipped (tracking / bus fields) → delivered →
-- buyer confirms → reviews. Disputes with admin mediation feed the trust metrics.
-- The platform never holds money: payments are buyer → seller (GCash/Maya/bank/COD) with proof uploads.
--
-- Every status change goes through a SECURITY DEFINER function that checks who may do it and from which
-- state. Direct UPDATEs on the new flow are blocked by orders_guard.

-- ───────────────────────── Shipping methods (configurable by sellers AND buyers) ─────────────────────────
create type public.shipping_kind as enum ('courier', 'on_demand', 'trucking', 'bus', 'van_jeep', 'pickup', 'other');

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  kind public.shipping_kind not null,
  owner_id uuid references public.profiles (id) on delete cascade,   -- null = built-in list
  notes text check (char_length(notes) <= 200),
  link text check (char_length(link) <= 300),                        -- booking / tracking website
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index shipping_methods_system_name on public.shipping_methods (lower(name)) where owner_id is null;
create unique index shipping_methods_owner_name on public.shipping_methods (owner_id, lower(name)) where owner_id is not null;

create table public.store_shipping_methods (
  store_id uuid not null references public.stores (id) on delete cascade,
  method_id uuid not null references public.shipping_methods (id) on delete cascade,
  note text check (char_length(note) <= 200),
  primary key (store_id, method_id)
);
create table public.listing_shipping_methods (
  listing_id uuid not null references public.listings (id) on delete cascade,
  method_id uuid not null references public.shipping_methods (id) on delete cascade,
  primary key (listing_id, method_id)
);
alter table public.listings add column weight_kg numeric(8, 2) check (weight_kg > 0);

create or replace function public.shipping_methods_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (select count(*) from public.shipping_methods where owner_id = auth.uid()) >= 25 then
    raise exception 'You can save up to 25 custom shipping methods' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger shipping_methods_guard_t before insert on public.shipping_methods
  for each row execute function public.shipping_methods_guard();

-- ───────────────────────── Seller payment accounts (shown only to a buyer with a quoted order) ─────────────────────────
create table public.store_payment_methods (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  kind text not null check (kind in ('gcash', 'maya', 'bank', 'cod', 'other')),
  account_name text check (char_length(account_name) <= 80),
  account_number text check (char_length(account_number) <= 40),
  bank_name text check (char_length(bank_name) <= 60),
  instructions text check (char_length(instructions) <= 300),
  created_at timestamptz not null default now(),
  check (kind = 'cod' or (account_name is not null and account_number is not null))
);
create index store_payment_methods_store on public.store_payment_methods (store_id);

-- ───────────────────────── Orders: extend the Phase 2 table ─────────────────────────
alter table public.orders
  add column is_full_flow boolean not null default false,   -- false = Phase 2 "recorded deal"
  add column urgency text not null default 'standard' check (urgency in ('standard', 'urgent')),
  add column buyer_note text check (char_length(buyer_note) <= 500),
  add column seller_note text check (char_length(seller_note) <= 500),
  add column shipping_fee numeric(12, 2) not null default 0 check (shipping_fee >= 0),
  add column preferred_method_id uuid references public.shipping_methods (id) on delete set null,
  add column shipping_method_id uuid references public.shipping_methods (id) on delete set null,
  add column payment_method text check (payment_method in ('gcash', 'maya', 'bank', 'cod', 'other')),
  add column cod boolean not null default false,
  add column cancelled_from text,
  add column cancel_reason text check (char_length(cancel_reason) <= 300),
  add column quoted_at timestamptz,
  add column quote_expires_at timestamptz,
  add column paid_at timestamptz,
  add column packed_at timestamptz,
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  add column prev_status text;
create index orders_full_flow on public.orders (status) where is_full_flow;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  title text not null,
  unit text not null,
  quantity integer not null check (quantity >= 1),
  unit_price numeric(12, 2) check (unit_price >= 0),     -- null until the seller prices it (range / message-for-price)
  available_qty integer check (available_qty >= 0),      -- seller's confirmation at quote time
  packed boolean not null default false,
  created_at timestamptz not null default now()
);
create index order_items_order on public.order_items (order_id);

-- Delivery details are personal data: only the two parties (and admins during a dispute) can read them.
create table public.order_delivery (
  order_id uuid primary key references public.orders (id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 2 and 80),
  phone text not null check (char_length(phone) between 7 and 20),
  address text not null check (char_length(address) between 5 and 300),
  landmark text check (char_length(landmark) <= 200),
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 1000000),
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create or replace function public.cart_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.cart_items where user_id = new.user_id) >= 50 then raise exception 'Your cart is full (50 items)' using errcode = 'P0001'; end if;
  if exists (select 1 from public.listings l join public.stores s on s.id = l.store_id where l.id = new.listing_id and s.owner_id = new.user_id) then
    raise exception 'You cannot buy from your own store' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cart_guard_t before insert on public.cart_items for each row execute function public.cart_guard();

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id),
  method text not null check (method in ('gcash', 'maya', 'bank', 'other')),
  reference_no text not null check (char_length(reference_no) between 4 and 60),
  amount numeric(12, 2) not null check (amount >= 0),
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  seller_note text check (char_length(seller_note) <= 300),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index payment_proofs_order on public.payment_proofs (order_id);

-- Photo proof of the packed goods. created_at is set by the server, so the timestamp can't be backdated.
create table public.packing_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  photo_path text not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index packing_proofs_order on public.packing_proofs (order_id);

create table public.shipments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  method_id uuid references public.shipping_methods (id) on delete set null,
  method_name text not null,      -- snapshot, so history survives method edits/deletes
  method_kind public.shipping_kind not null default 'other',
  tracking_number text check (char_length(tracking_number) <= 80),
  booking_link text check (char_length(booking_link) <= 300),
  driver_name text check (char_length(driver_name) <= 80),
  driver_phone text check (char_length(driver_phone) <= 20),
  plate_no text check (char_length(plate_no) <= 20),
  bus_line text check (char_length(bus_line) <= 80),
  bus_terminal_from text check (char_length(bus_terminal_from) <= 120),
  bus_terminal_to text check (char_length(bus_terminal_to) <= 120),
  eta timestamptz,
  waybill_path text,
  notes text check (char_length(notes) <= 300),
  shipped_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  respondent_id uuid not null references public.profiles (id),
  reason text not null check (reason in ('not_received', 'not_as_described', 'damaged', 'incomplete', 'payment_not_received', 'no_response', 'other')),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  response_due_at timestamptz not null,
  response_body text check (char_length(response_body) <= 2000),
  responded_at timestamptz,
  outcome text check (outcome in ('buyer_favored', 'seller_favored', 'partial', 'no_fault')),
  admin_note text check (char_length(admin_note) <= 1000),   -- visible to both parties
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index disputes_one_open on public.disputes (order_id) where status = 'open';
create index disputes_status on public.disputes (status, created_at);

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id),
  storage_path text not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);

-- Private bucket for payment proofs, packing photos, waybills and dispute evidence (read only via server-signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-files', 'order-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "own upload order files" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-files' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.document_access_logs drop constraint if exists document_access_logs_kind_check;
alter table public.document_access_logs add constraint document_access_logs_kind_check check (kind in ('verification', 'evidence', 'order_file'));

-- ───────────────────────── Guards (rewritten) ─────────────────────────
-- Functions below set app.order_fn so their own writes skip the "direct edit" restrictions.
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); recent int; pending int;
begin
  if tg_op = 'INSERT' then
    new.seller_id := (select owner_id from public.stores where id = new.store_id);
    if coalesce(current_setting('app.order_fn', true), '') = '1' then return new; end if;
    if uid is not null then
      perform public.assert_not_restricted(uid);
      new.status := 'pending_confirmation'; new.confirmed_at := null; new.cancelled_by := null; new.is_full_flow := false;
      select count(*) into recent from public.orders where seller_id = uid and created_at > now() - interval '1 day';
      if recent >= 30 then raise exception 'Daily deal limit reached' using errcode = 'P0001'; end if;
      select count(*) into pending from public.orders where seller_id = uid and buyer_id = new.buyer_id and status = 'pending_confirmation';
      if pending >= 3 then raise exception 'Too many unconfirmed deals with this buyer' using errcode = 'P0001'; end if;
    end if;
    return new;
  end if;

  if coalesce(current_setting('app.order_fn', true), '') = '1' then return new; end if;
  if uid is null or public.is_admin() then return new; end if;
  if (new.store_id, new.seller_id, new.buyer_id, new.summary, new.quantity, new.amount, new.conversation_id, new.listing_id, new.created_at, new.is_full_flow)
     is distinct from (old.store_id, old.seller_id, old.buyer_id, old.summary, old.quantity, old.amount, old.conversation_id, old.listing_id, old.created_at, old.is_full_flow) then
    raise exception 'Deal details cannot be edited';
  end if;
  if old.status <> 'pending_confirmation' then raise exception 'This order can only be changed from its order page'; end if;
  if new.status = 'completed' then
    if uid <> old.buyer_id then raise exception 'Only the buyer can confirm a deal'; end if;
    new.confirmed_at := now();
  elsif new.status = 'cancelled' then
    new.cancelled_by := uid; new.cancelled_from := 'pending_confirmation';
  else
    raise exception 'Invalid status change';
  end if;
  return new;
end $$;

create or replace function public.orders_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending_confirmation' then
      perform public.notify(new.buyer_id, 'deal_proposed', jsonb_build_object('summary', new.summary), '/orders/' || new.id);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'completed' and old.status <> 'disputed' then
      perform public.notify(new.seller_id, 'deal_confirmed', jsonb_build_object('summary', new.summary), '/orders/' || new.id);
    elsif new.status = 'cancelled' and old.status <> 'disputed' then
      perform public.notify(case when new.cancelled_by = new.buyer_id then new.seller_id else new.buyer_id end,
        'deal_cancelled', jsonb_build_object('summary', new.summary, 'note', new.cancel_reason), '/orders/' || new.id);
    end if;
  end if;
  return new;
end $$;

-- ───────────────────────── Order workflow functions ─────────────────────────
create or replace function public.place_order(p_store uuid, p_items jsonb, p_delivery jsonb, p_urgency text default 'standard', p_preferred uuid default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s record; it jsonb; l record; qty int; price numeric; oid uuid; convo uuid; sub numeric := 0; qsum int := 0; summ text;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  perform public.assert_not_restricted(uid);
  select * into s from public.stores where id = p_store;
  if not found then raise exception 'Store not found'; end if;
  if s.owner_id = uid then raise exception 'You cannot order from your own store'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Add at least one item'; end if;
  if p_urgency not in ('standard', 'urgent') then raise exception 'Invalid urgency'; end if;
  if (select count(*) from public.orders where buyer_id = uid and is_full_flow and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily order limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders where buyer_id = uid and store_id = p_store and status in ('requested', 'quoted')) >= 3 then
    raise exception 'You already have open requests with this store' using errcode = 'P0001';
  end if;
  if p_preferred is not null and not exists (select 1 from public.shipping_methods where id = p_preferred and (owner_id is null or owner_id = uid)) then
    raise exception 'Invalid shipping method';
  end if;
  if jsonb_typeof(p_delivery) <> 'object' or coalesce(p_delivery ->> 'recipient_name', '') = '' or coalesce(p_delivery ->> 'phone', '') = '' or coalesce(p_delivery ->> 'address', '') = '' then
    raise exception 'Delivery name, phone and address are required';
  end if;

  perform set_config('app.order_fn', '1', true);
  insert into public.orders (store_id, seller_id, buyer_id, summary, quantity, amount, status, is_full_flow, urgency, buyer_note, preferred_method_id)
    values (p_store, s.owner_id, uid, 'New order', 1, 0, 'requested', true, p_urgency, left(nullif(trim(p_note), ''), 500), p_preferred)
    returning id into oid;

  for it in select * from jsonb_array_elements(p_items) loop
    select li.* into l from public.listings li where li.id = (it ->> 'listing_id')::uuid and li.store_id = p_store and li.status = 'active';
    if not found then raise exception 'An item is no longer available'; end if;
    qty := (it ->> 'quantity')::int;
    if qty is null or qty < l.moq then raise exception 'Minimum order for "%" is % %', l.title, l.moq, l.unit; end if;
    if l.stock_status = 'out_of_stock' then raise exception '"%" is out of stock', l.title; end if;
    price := case
      when l.price_type = 'fixed' then coalesce((select t.unit_price from public.listing_price_tiers t where t.listing_id = l.id and t.min_qty <= qty order by t.min_qty desc limit 1), l.price_min)
      else null end;   -- range / message: the seller sets the price in the quote
    insert into public.order_items (order_id, listing_id, title, unit, quantity, unit_price) values (oid, l.id, l.title, l.unit, qty, price);
    qsum := qsum + qty;
    if price is not null then sub := sub + price * qty; end if;
  end loop;

  summ := left((select string_agg(title || ' ×' || quantity, ', ' order by title) from public.order_items where order_id = oid), 200);
  update public.orders set summary = coalesce(nullif(summ, ''), 'New order'), quantity = qsum, amount = sub where id = oid;

  insert into public.order_delivery (order_id, recipient_name, phone, address, landmark, region_code, province_code, city_code)
    values (oid, left(p_delivery ->> 'recipient_name', 80), left(p_delivery ->> 'phone', 20), left(p_delivery ->> 'address', 300),
            left(nullif(p_delivery ->> 'landmark', ''), 200), nullif(p_delivery ->> 'region_code', ''), nullif(p_delivery ->> 'province_code', ''), nullif(p_delivery ->> 'city_code', ''));

  select id into convo from public.conversations where buyer_id = uid and store_id = p_store and listing_id is null;
  if convo is null then insert into public.conversations (buyer_id, store_id) values (uid, p_store) returning id into convo; end if;
  update public.orders set conversation_id = convo where id = oid;

  delete from public.cart_items where user_id = uid and listing_id in (select listing_id from public.order_items where order_id = oid);
  perform public.notify(s.owner_id, 'order_requested', jsonb_build_object('summary', left(summ, 80)), '/orders/' || oid);
  return oid;
end $$;

create or replace function public.quote_order(p_order uuid, p_items jsonb, p_shipping_fee numeric, p_method uuid default null, p_note text default null, p_valid_days integer default 3)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; it jsonb; total numeric; qsum int;
begin
  select * into o from public.orders where id = p_order and seller_id = uid and is_full_flow and status in ('requested', 'quoted') for update;
  if not found then raise exception 'Order not found or it can no longer be quoted'; end if;
  if p_valid_days not between 1 and 14 then raise exception 'Quote validity must be 1 to 14 days'; end if;
  if p_shipping_fee is null or p_shipping_fee < 0 or p_shipping_fee > 1000000 then raise exception 'Invalid shipping fee'; end if;
  if p_method is not null and not exists (select 1 from public.shipping_methods m where m.id = p_method and (m.owner_id is null or m.owner_id = uid or m.id = o.preferred_method_id)) then
    raise exception 'Invalid shipping method';
  end if;
  perform set_config('app.order_fn', '1', true);
  for it in select * from jsonb_array_elements(p_items) loop
    update public.order_items set unit_price = nullif(it ->> 'unit_price', '')::numeric, available_qty = (it ->> 'available_qty')::int
     where id = (it ->> 'id')::uuid and order_id = p_order;
    if not found then raise exception 'Unknown order item'; end if;
  end loop;
  if exists (select 1 from public.order_items where order_id = p_order
              and (available_qty is null or available_qty > quantity or (available_qty > 0 and unit_price is null))) then
    raise exception 'Set a price and an available quantity (0 if unavailable) for every item';
  end if;
  select coalesce(sum(unit_price * available_qty), 0), coalesce(sum(available_qty), 0) into total, qsum from public.order_items where order_id = p_order and available_qty > 0;
  if qsum = 0 then raise exception 'At least one item must be available. Cancel the order if nothing is.'; end if;
  update public.orders set amount = total + p_shipping_fee, quantity = qsum, shipping_fee = p_shipping_fee, shipping_method_id = p_method,
         seller_note = left(nullif(trim(p_note), ''), 500), status = 'quoted', quoted_at = now(), quote_expires_at = now() + make_interval(days => p_valid_days)
   where id = p_order;
  perform public.notify(o.buyer_id, 'order_quoted', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
end $$;

-- Where to pay. Only the buyer of a quoted order, the seller and admins can see a store's payment accounts.
create or replace function public.order_payment_options(p_order uuid)
returns table (id uuid, kind text, account_name text, account_number text, bank_name text, instructions text)
language sql stable security definer set search_path = public as $$
  select m.id, m.kind, m.account_name, m.account_number, m.bank_name, m.instructions
    from public.orders o join public.store_payment_methods m on m.store_id = o.store_id
   where o.id = p_order and o.is_full_flow
     and ((o.buyer_id = auth.uid() and o.status in ('quoted', 'payment_submitted', 'paid', 'packed', 'shipped', 'delivered'))
          or o.seller_id = auth.uid() or public.is_admin());
$$;

create or replace function public.submit_payment(p_order uuid, p_method text, p_reference text default null, p_amount numeric default 0, p_proof_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record;
begin
  select * into o from public.orders where id = p_order and buyer_id = uid and is_full_flow and status = 'quoted' for update;
  if not found then raise exception 'This order is not waiting for payment'; end if;
  if o.quote_expires_at < now() then raise exception 'This quote has expired. Ask the seller for a new one.'; end if;
  perform public.assert_not_restricted(uid);
  if p_method not in ('gcash', 'maya', 'bank', 'cod', 'other') then raise exception 'Invalid payment method'; end if;
  if not exists (select 1 from public.store_payment_methods where store_id = o.store_id and kind = p_method) then
    raise exception 'The seller does not accept that payment method';
  end if;
  perform set_config('app.order_fn', '1', true);
  if p_method = 'cod' then
    update public.orders set status = 'paid', cod = true, payment_method = 'cod', paid_at = now() where id = p_order;
    perform public.notify(o.seller_id, 'payment_cod', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
    return;
  end if;
  if p_proof_path is null or p_proof_path not like uid::text || '/%' then raise exception 'Attach a screenshot of your payment'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 4 then raise exception 'Enter the payment reference number'; end if;
  insert into public.payment_proofs (order_id, uploader_id, method, reference_no, amount, proof_path)
    values (p_order, uid, p_method, trim(p_reference), coalesce(p_amount, 0), p_proof_path);
  update public.orders set status = 'payment_submitted', payment_method = p_method where id = p_order;
  perform public.notify(o.seller_id, 'payment_submitted', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
end $$;

create or replace function public.review_payment(p_order uuid, p_confirm boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; proof uuid;
begin
  select * into o from public.orders where id = p_order and seller_id = uid and is_full_flow and status = 'payment_submitted' for update;
  if not found then raise exception 'There is no payment to review'; end if;
  select id into proof from public.payment_proofs where order_id = p_order and status = 'pending' order by created_at desc limit 1;
  perform set_config('app.order_fn', '1', true);
  update public.payment_proofs set status = case when p_confirm then 'confirmed' else 'rejected' end, seller_note = left(nullif(trim(p_note), ''), 300), reviewed_at = now() where id = proof;
  if p_confirm then
    update public.orders set status = 'paid', paid_at = now() where id = p_order;
    perform public.notify(o.buyer_id, 'payment_confirmed', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
  else
    update public.orders set status = 'quoted', quote_expires_at = greatest(quote_expires_at, now() + interval '2 days') where id = p_order;
    perform public.notify(o.buyer_id, 'payment_rejected', jsonb_build_object('summary', left(o.summary, 80), 'note', nullif(trim(p_note), '')), '/orders/' || p_order);
  end if;
end $$;

-- Packing list with photo proof: every available item must be ticked and at least one photo attached.
create or replace function public.submit_packing(p_order uuid, p_checked uuid[], p_photos text[], p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; ph text;
begin
  select * into o from public.orders where id = p_order and seller_id = uid and is_full_flow and status = 'paid' for update;
  if not found then raise exception 'This order is not ready to be packed'; end if;
  if coalesce(cardinality(p_photos), 0) not between 1 and 6 then raise exception 'Add 1 to 6 photos of the packed items'; end if;
  foreach ph in array p_photos loop
    if ph not like uid::text || '/%' then raise exception 'Invalid photo path'; end if;
  end loop;
  if exists (select 1 from public.order_items i where i.order_id = p_order and i.available_qty > 0 and not (i.id = any (coalesce(p_checked, '{}')))) then
    raise exception 'Tick every item on the packing list';
  end if;
  perform set_config('app.order_fn', '1', true);
  update public.order_items set packed = true where order_id = p_order and available_qty > 0;
  insert into public.packing_proofs (order_id, photo_path, note) select p_order, x, left(nullif(trim(p_note), ''), 300) from unnest(p_photos) x;
  update public.orders set status = 'packed', packed_at = now() where id = p_order;
  perform public.notify(o.buyer_id, 'order_packed', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
end $$;

create or replace function public.ship_order(p_order uuid, p_method uuid default null, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; m record; wb text := nullif(p_details ->> 'waybill_path', ''); mname text; mkind public.shipping_kind;
begin
  select * into o from public.orders where id = p_order and seller_id = uid and is_full_flow and status = 'packed' for update;
  if not found then raise exception 'Pack the order (with photos) before shipping it'; end if;
  if p_method is not null then
    select * into m from public.shipping_methods sm where sm.id = p_method and (sm.owner_id is null or sm.owner_id = uid or sm.id = o.preferred_method_id);
    if not found then raise exception 'Invalid shipping method'; end if;
    mname := m.name; mkind := m.kind;
  else
    mname := left(nullif(trim(p_details ->> 'method_name'), ''), 60); mkind := 'other';
    if mname is null then raise exception 'Choose or name the shipping method'; end if;
  end if;
  if wb is not null and wb not like uid::text || '/%' then raise exception 'Invalid waybill path'; end if;
  perform set_config('app.order_fn', '1', true);
  insert into public.shipments (order_id, method_id, method_name, method_kind, tracking_number, booking_link, driver_name, driver_phone, plate_no, bus_line,
                                bus_terminal_from, bus_terminal_to, eta, waybill_path, notes)
  values (p_order, p_method, mname, mkind, left(nullif(p_details ->> 'tracking_number', ''), 80), left(nullif(p_details ->> 'booking_link', ''), 300),
          left(nullif(p_details ->> 'driver_name', ''), 80), left(nullif(p_details ->> 'driver_phone', ''), 20), left(nullif(p_details ->> 'plate_no', ''), 20),
          left(nullif(p_details ->> 'bus_line', ''), 80), left(nullif(p_details ->> 'bus_terminal_from', ''), 120), left(nullif(p_details ->> 'bus_terminal_to', ''), 120),
          nullif(p_details ->> 'eta', '')::timestamptz, wb, left(nullif(p_details ->> 'notes', ''), 300))
  on conflict (order_id) do nothing;
  update public.orders set status = 'shipped', shipped_at = now(), shipping_method_id = coalesce(p_method, shipping_method_id) where id = p_order;
  perform public.notify(o.buyer_id, 'order_shipped', jsonb_build_object('summary', left(o.summary, 80), 'method', mname), '/orders/' || p_order);
end $$;

create or replace function public.mark_delivered(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record;
begin
  select * into o from public.orders where id = p_order and seller_id = uid and is_full_flow and status = 'shipped' for update;
  if not found then raise exception 'This order has not been shipped'; end if;
  perform set_config('app.order_fn', '1', true);
  update public.orders set status = 'delivered', delivered_at = now() where id = p_order;
  perform public.notify(o.buyer_id, 'order_delivered', jsonb_build_object('summary', left(o.summary, 80)), '/orders/' || p_order);
end $$;

create or replace function public.confirm_received(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record;
begin
  select * into o from public.orders where id = p_order and buyer_id = uid and is_full_flow and status in ('shipped', 'delivered') for update;
  if not found then raise exception 'There is nothing to confirm yet'; end if;
  perform set_config('app.order_fn', '1', true);
  update public.orders set status = 'completed', confirmed_at = now(), delivered_at = coalesce(delivered_at, now()) where id = p_order;
end $$;

create or replace function public.cancel_order(p_order uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record;
begin
  select * into o from public.orders where id = p_order and (buyer_id = uid or seller_id = uid) and is_full_flow for update;
  if not found then raise exception 'Order not found'; end if;
  if uid = o.buyer_id and o.status not in ('requested', 'quoted') then
    raise exception 'You can only cancel before paying. Ask the seller to cancel, or open a dispute.';
  elsif uid = o.seller_id and o.status not in ('requested', 'quoted', 'payment_submitted', 'paid', 'packed') then
    raise exception 'This order can no longer be cancelled';
  end if;
  perform set_config('app.order_fn', '1', true);
  update public.orders set status = 'cancelled', cancelled_by = uid, cancelled_from = o.status::text, cancel_reason = left(nullif(trim(p_reason), ''), 300) where id = p_order;
end $$;

-- ───────────────────────── Disputes ─────────────────────────
create or replace function public.open_dispute(p_order uuid, p_reason text, p_details text, p_paths text[] default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; did uuid; other uuid; pth text;
begin
  select * into o from public.orders where id = p_order and (buyer_id = uid or seller_id = uid) and is_full_flow for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('paid', 'packed', 'shipped', 'delivered') and not (o.status = 'completed' and o.confirmed_at > now() - interval '14 days') then
    raise exception 'A dispute can only be opened on a paid order (or within 14 days after completion)';
  end if;
  if coalesce(cardinality(p_paths), 0) > 6 then raise exception 'Attach up to 6 files'; end if;
  other := case when uid = o.buyer_id then o.seller_id else o.buyer_id end;
  insert into public.disputes (order_id, opened_by, respondent_id, reason, details, response_due_at)
    values (p_order, uid, other, p_reason, trim(p_details), now() + interval '3 days') returning id into did;
  foreach pth in array coalesce(p_paths, '{}') loop
    if pth not like uid::text || '/%' then raise exception 'Invalid file path'; end if;
    insert into public.dispute_evidence (dispute_id, uploader_id, storage_path) values (did, uid, pth);
  end loop;
  perform set_config('app.order_fn', '1', true);
  update public.orders set prev_status = o.status::text, status = 'disputed' where id = p_order;
  perform public.notify(other, 'dispute_opened', jsonb_build_object('reason', p_reason), '/orders/' || p_order);
  return did;
end $$;

create or replace function public.dispute_respond(p_dispute uuid, p_body text, p_paths text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d record; pth text;
begin
  select * into d from public.disputes where id = p_dispute and respondent_id = uid and status = 'open' for update;
  if not found then raise exception 'Dispute not found'; end if;
  if d.responded_at is not null then raise exception 'You already responded'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 5 then raise exception 'Please explain your side'; end if;
  update public.disputes set response_body = trim(p_body), responded_at = now() where id = p_dispute;
  foreach pth in array coalesce(p_paths, '{}') loop
    if pth not like uid::text || '/%' then raise exception 'Invalid file path'; end if;
    insert into public.dispute_evidence (dispute_id, uploader_id, storage_path) values (p_dispute, uid, pth);
  end loop;
end $$;

create or replace function public.resolve_dispute(p_dispute uuid, p_outcome text, p_note text, p_result text default null)
returns void language plpgsql security definer set search_path = public as $$
declare d record; o record; final text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Only an admin can resolve disputes'; end if;
  if p_outcome not in ('buyer_favored', 'seller_favored', 'partial', 'no_fault') then raise exception 'Invalid outcome'; end if;
  select * into d from public.disputes where id = p_dispute and status = 'open' for update;
  if not found then raise exception 'Dispute is not open'; end if;
  if d.responded_at is null and now() < d.response_due_at then raise exception 'The response window is still open'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 5 then raise exception 'Write a note both parties will read'; end if;
  final := case p_outcome when 'buyer_favored' then 'cancelled' when 'seller_favored' then 'completed' else p_result end;
  if final is null or final not in ('completed', 'cancelled') then raise exception 'Choose how the order ends (completed or cancelled)'; end if;
  select * into o from public.orders where id = d.order_id for update;
  perform set_config('app.order_fn', '1', true);
  update public.disputes set status = 'resolved', outcome = p_outcome, admin_note = trim(p_note), resolved_by = auth.uid(), resolved_at = now() where id = p_dispute;
  update public.orders set status = final::public.order_status,
         confirmed_at = case when final = 'completed' then coalesce(confirmed_at, now()) else confirmed_at end,
         cancelled_from = case when final = 'cancelled' then 'disputed' else cancelled_from end
   where id = d.order_id;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), 'DISPUTE_' || upper(p_outcome), 'disputes', p_dispute::text, jsonb_build_object('order', d.order_id, 'final', final));
  perform public.notify(o.buyer_id, 'dispute_resolved', jsonb_build_object('outcome', p_outcome, 'note', trim(p_note)), '/orders/' || d.order_id);
  perform public.notify(o.seller_id, 'dispute_resolved', jsonb_build_object('outcome', p_outcome, 'note', trim(p_note)), '/orders/' || d.order_id);
end $$;

-- ───────────────────────── Trust metrics now use disputes + payments ─────────────────────────
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
           coalesce(sum(quantity) filter (where status = 'completed'), 0) as qty
      from public.orders where store_id = p_store),
  lost as (  -- disputes an admin resolved against the seller (fully or partly); open disputes never count
    select count(*) as n from public.disputes d join public.orders od on od.id = d.order_id
     where od.store_id = p_store and d.outcome in ('buyer_favored', 'partial')),
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
         case when o.done + lost.n > 0 then round(lost.n::numeric / (o.done + lost.n), 3) end,
         (select created_at from public.stores where id = p_store)
    from o, lost, r, resp;
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
           -- walking away after the seller quoted / you paid counts; cancelling a request or declining a wrong deal record does not
           count(*) filter (where status = 'cancelled' and cancelled_by = p_user and cancelled_from in ('quoted', 'payment_submitted', 'paid')) as cancelled
      from public.orders where buyer_id = p_user),
  r as (select count(*) as n, avg(rating) as a from public.reviews where reviewee_id = p_user and direction = 'seller_to_buyer'),
  pay as (
    select count(*) filter (where status = 'confirmed') as ok, count(*) filter (where status in ('confirmed', 'rejected')) as reviewed
      from public.payment_proofs where uploader_id = p_user)
  select o.done::int, public.amount_range(o.amt),
         case when o.done + o.cancelled > 0 then round(o.cancelled::numeric / (o.done + o.cancelled), 3) end,
         round(r.a, 2), r.n::int,
         case when pay.reviewed > 0 then round(pay.ok::numeric / pay.reviewed, 2) end,
         (select created_at from public.profiles where id = p_user)
    from o, r, pay;
$$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.shipping_methods enable row level security;
alter table public.store_shipping_methods enable row level security;
alter table public.listing_shipping_methods enable row level security;
alter table public.store_payment_methods enable row level security;
alter table public.order_items enable row level security;
alter table public.order_delivery enable row level security;
alter table public.cart_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.packing_proofs enable row level security;
alter table public.shipments enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_evidence enable row level security;

-- helper: is the caller a participant of this order?
create or replace function public.is_order_participant(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = p_order and (buyer_id = auth.uid() or seller_id = auth.uid()));
$$;

-- (SECURITY DEFINER so the shipping_methods policy doesn't recurse through the link tables' own policies)
create or replace function public.shipping_method_is_listed(p_method uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.store_shipping_methods where method_id = p_method)
      or exists (select 1 from public.listing_shipping_methods where method_id = p_method);
$$;
grant execute on function public.shipping_method_is_listed(uuid) to anon, authenticated;

-- shipping methods: built-ins for everyone; your own; ones a store lists; ones attached to your orders
create policy shipping_read on public.shipping_methods for select using (
  owner_id is null or owner_id = auth.uid() or public.is_admin()
  or public.shipping_method_is_listed(shipping_methods.id)
  or exists (select 1 from public.orders o where (o.buyer_id = auth.uid() or o.seller_id = auth.uid()) and (o.preferred_method_id = shipping_methods.id or o.shipping_method_id = shipping_methods.id))
);
create policy shipping_insert on public.shipping_methods for insert with check (owner_id = auth.uid());
create policy shipping_update on public.shipping_methods for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shipping_delete on public.shipping_methods for delete using (owner_id = auth.uid());
create policy shipping_admin on public.shipping_methods for all using (public.is_admin() and owner_id is null) with check (public.is_admin() and owner_id is null);

create policy store_ship_read on public.store_shipping_methods for select using (true);
create policy store_ship_insert on public.store_shipping_methods for insert
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
              and exists (select 1 from public.shipping_methods m where m.id = method_id and (m.owner_id is null or m.owner_id = auth.uid())));
create policy store_ship_update on public.store_shipping_methods for update
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy store_ship_delete on public.store_shipping_methods for delete
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy listing_ship_read on public.listing_shipping_methods for select using (true);
create policy listing_ship_insert on public.listing_shipping_methods for insert
  with check (exists (select 1 from public.listings l join public.stores s on s.id = l.store_id where l.id = listing_id and s.owner_id = auth.uid())
              and exists (select 1 from public.shipping_methods m where m.id = method_id and (m.owner_id is null or m.owner_id = auth.uid())));
create policy listing_ship_delete on public.listing_shipping_methods for delete
  using (exists (select 1 from public.listings l join public.stores s on s.id = l.store_id where l.id = listing_id and s.owner_id = auth.uid()));

-- payment accounts: owner only (buyers get them through order_payment_options)
create policy paymeth_owner on public.store_payment_methods for all
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

create policy order_items_read on public.order_items for select using (public.is_order_participant(order_id) or public.is_admin());
create policy order_delivery_read on public.order_delivery for select using (
  public.is_order_participant(order_id)
  or (public.is_admin() and exists (select 1 from public.disputes d where d.order_id = order_delivery.order_id))
);
create policy cart_own on public.cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy proofs_read on public.payment_proofs for select using (public.is_order_participant(order_id) or public.is_admin());
create policy packing_read on public.packing_proofs for select using (public.is_order_participant(order_id) or public.is_admin());
create policy shipments_read on public.shipments for select using (public.is_order_participant(order_id) or public.is_admin());
create policy disputes_read on public.disputes for select using (public.is_order_participant(order_id) or public.is_admin());
create policy dispute_evidence_read on public.dispute_evidence for select using (
  exists (select 1 from public.disputes d where d.id = dispute_id and (public.is_order_participant(d.order_id) or public.is_admin()))
);

create trigger audit_disputes after update on public.disputes for each row execute function public.log_admin_change();

-- ───────────────────────── Built-in shipping methods ─────────────────────────
insert into public.shipping_methods (name, kind, notes) values
  ('Lalamove', 'on_demand', 'Same-day delivery within a city or nearby areas'),
  ('Grab Express', 'on_demand', 'Same-day delivery within a city'),
  ('Transportify', 'on_demand', 'Vans and trucks for bigger loads, same day'),
  ('Borzo', 'on_demand', 'Same-day courier'),
  ('J&T Express', 'courier', null),
  ('LBC', 'courier', null),
  ('Ninja Van', 'courier', null),
  ('Flash Express', 'courier', null),
  ('JRS Express', 'courier', null),
  ('2GO', 'courier', 'Air and sea freight, good for island-to-island'),
  ('SPX Express', 'courier', null),
  ('Trucking / truck for hire', 'trucking', 'For heavy or bulk orders; agree on the rate in chat'),
  ('Bus terminal-to-terminal (cargo)', 'bus', 'Send via a bus line''s cargo service and pick up at the destination terminal'),
  ('Van / jeep padala', 'van_jeep', 'Send via a van or jeepney line to nearby towns'),
  ('Pickup / meetup', 'pickup', 'Buyer picks up, or you meet at an agreed safe place');

-- ───────────────────────── Lock down workflow functions ─────────────────────────
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('place_order', 'quote_order', 'order_payment_options', 'submit_payment', 'review_payment',
              'submit_packing', 'ship_order', 'mark_delivered', 'confirm_received', 'cancel_order', 'open_dispute', 'dispute_respond', 'resolve_dispute', 'is_order_participant')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
