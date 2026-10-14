-- Delivery riders: people register as riders (driver's license, OR/CR and plate photos, checked by an admin, founder or
-- webmaster, who grants the "Verified rider" badge), and buyers or sellers book a rider to pick up and deliver a parcel.
-- New tables only; existing data is untouched.
--
-- Privacy: a booking's exact addresses, contact names and phone numbers are visible only to the person who booked,
-- the rider who got the job, the buyer and seller of a linked order, and admins. Other riders only see the city,
-- parcel details and fee through open_deliveries() / delivery_summary().

alter table public.user_badges drop constraint user_badges_badge_check;
alter table public.user_badges add constraint user_badges_badge_check
  check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified', 'verified_rider'));

alter table public.document_access_logs drop constraint document_access_logs_kind_check;
alter table public.document_access_logs add constraint document_access_logs_kind_check
  check (kind in ('verification', 'evidence', 'order_file', 'rider'));

/* ───────── Riders ───────── */

create table public.rider_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  id uuid not null unique default gen_random_uuid(), -- for the admin audit log
  full_name text not null check (char_length(full_name) between 3 and 80),
  phone text not null check (phone ~ '^\+?[0-9]{7,13}$'),
  vehicle_type text not null check (vehicle_type in ('motorcycle', 'sedan', 'mpv_suv', 'pickup', 'l300_h100', 'closed_van', 'truck')),
  vehicle_model text check (char_length(vehicle_model) <= 60),
  plate_number text not null check (plate_number ~ '^[A-Z0-9][A-Z0-9 -]{1,10}$'),
  license_number text not null check (char_length(license_number) between 5 and 20),
  license_expiry date not null,
  region_code text not null references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  about text check (char_length(about) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'needs_more', 'rejected', 'suspended')),
  is_available boolean not null default true,
  admin_note text check (char_length(admin_note) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index rider_profiles_status on public.rider_profiles (status, submitted_at);
create index rider_profiles_area on public.rider_profiles (region_code, province_code, city_code) where status = 'approved';
alter table public.rider_profiles enable row level security;
-- Personal details (license number, phone) stay private: the rider and staff only. Everyone else uses public_riders().
create policy rider_profiles_read on public.rider_profiles for select using (user_id = auth.uid() or public.is_admin());
create trigger audit_rider_profiles after update or delete on public.rider_profiles
  for each row execute function public.log_admin_change();

create table public.rider_documents (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.rider_profiles (user_id) on delete cascade,
  doc_type text not null check (doc_type in ('license_front', 'license_back', 'or_cr', 'plate_front', 'plate_back', 'other')),
  storage_path text not null check (char_length(storage_path) between 3 and 300),
  created_at timestamptz not null default now()
);
create index rider_documents_rider on public.rider_documents (rider_id);
alter table public.rider_documents enable row level security;
create policy rider_documents_read on public.rider_documents for select using (rider_id = auth.uid() or public.is_full_admin());

-- One call saves the application and its documents together, and puts it in the review queue.
-- Re-submitting (new license, new vehicle) sends an approved rider back to review until it is checked again.
create or replace function public.submit_rider_application(p jsonb, p_docs jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur record; d jsonb; t text;
begin
  if uid is null then raise exception 'Please sign in first'; end if;
  perform public.assert_not_restricted(uid);
  select * into cur from public.rider_profiles where user_id = uid for update;
  if found and cur.status = 'pending' then raise exception 'Already submitted. Please wait for the review'; end if;
  if found and cur.status = 'suspended' then raise exception 'Your rider account is suspended. Please contact MarketplacePH'; end if;
  if (p ->> 'license_expiry')::date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'Your driver''s license has expired. Please renew it first';
  end if;
  if jsonb_typeof(p_docs) <> 'array' or jsonb_array_length(p_docs) > 12 then raise exception 'Invalid documents'; end if;
  foreach t in array array['license_front', 'license_back', 'or_cr', 'plate_front', 'plate_back'] loop
    if not exists (select 1 from jsonb_array_elements(p_docs) x where x ->> 'type' = t) then
      raise exception 'Attach all required photos: license (front and back), OR/CR, and the vehicle with its plate (front and back)';
    end if;
  end loop;
  for d in select * from jsonb_array_elements(p_docs) loop
    if (d ->> 'path') not like uid::text || '/%' then raise exception 'Invalid documents'; end if;
  end loop;
  perform public.assert_clean_text(coalesce(p ->> 'about', '') || ' ' || coalesce(p ->> 'vehicle_model', ''));

  insert into public.rider_profiles (user_id, full_name, phone, vehicle_type, vehicle_model, plate_number, license_number,
                                     license_expiry, region_code, province_code, city_code, about)
  values (uid, trim(p ->> 'full_name'), p ->> 'phone', p ->> 'vehicle_type', nullif(trim(p ->> 'vehicle_model'), ''),
          upper(trim(p ->> 'plate_number')), upper(trim(p ->> 'license_number')), (p ->> 'license_expiry')::date,
          p ->> 'region_code', nullif(p ->> 'province_code', ''), nullif(p ->> 'city_code', ''), nullif(trim(p ->> 'about'), ''))
  on conflict (user_id) do update set
    full_name = excluded.full_name, phone = excluded.phone, vehicle_type = excluded.vehicle_type,
    vehicle_model = excluded.vehicle_model, plate_number = excluded.plate_number, license_number = excluded.license_number,
    license_expiry = excluded.license_expiry, region_code = excluded.region_code, province_code = excluded.province_code,
    city_code = excluded.city_code, about = excluded.about,
    status = 'pending', admin_note = null, reviewed_by = null, reviewed_at = null, submitted_at = now();

  delete from public.rider_documents where rider_id = uid;
  insert into public.rider_documents (rider_id, doc_type, storage_path)
    select uid, x ->> 'type', x ->> 'path' from jsonb_array_elements(p_docs) x;
  delete from public.user_badges where user_id = uid and badge = 'verified_rider';
end $$;
revoke all on function public.submit_rider_application(jsonb, jsonb) from public, anon;
grant execute on function public.submit_rider_application(jsonb, jsonb) to authenticated;

-- Admin, founder or webmaster decides. Approval grants the "Verified rider" badge; anything else removes it.
create or replace function public.review_rider(p_user uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Only an admin, founder or webmaster can review riders'; end if;
  if p_decision not in ('approved', 'needs_more', 'rejected', 'suspended') then raise exception 'Invalid decision'; end if;
  if p_decision in ('needs_more', 'rejected', 'suspended') and coalesce(trim(p_note), '') = '' then
    raise exception 'Write a short note so the rider knows what to fix';
  end if;
  update public.rider_profiles set status = p_decision, admin_note = left(nullif(trim(p_note), ''), 500),
         reviewed_by = auth.uid(), reviewed_at = now()
   where user_id = p_user;
  if not found then raise exception 'Rider not found'; end if;
  if p_decision = 'approved' then
    insert into public.user_badges (user_id, badge, granted_by) values (p_user, 'verified_rider', auth.uid())
      on conflict (user_id, badge) do update set granted_by = excluded.granted_by, granted_at = now();
  else
    delete from public.user_badges where user_id = p_user and badge = 'verified_rider';
  end if;
  perform public.notify(p_user, 'rider_' || p_decision, jsonb_build_object('note', coalesce(p_note, '')), '/delivery/register');
end $$;
revoke all on function public.review_rider(uuid, text, text) from public, anon;
grant execute on function public.review_rider(uuid, text, text) to authenticated;

create or replace function public.set_rider_available(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.rider_profiles set is_available = p_on where user_id = auth.uid();
$$;
revoke all on function public.set_rider_available(boolean) from public, anon;
grant execute on function public.set_rider_available(boolean) to authenticated;

/* ───────── Bookings ───────── */

create table public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  item_description text not null check (char_length(item_description) between 3 and 200),
  quantity integer not null check (quantity between 1 and 100000),
  weight_per_piece_kg numeric(10, 2) not null check (weight_per_piece_kg > 0 and weight_per_piece_kg <= 5000),
  total_weight_kg numeric(12, 2) not null check (total_weight_kg > 0 and total_weight_kg <= 50000),
  length_cm numeric(8, 1) check (length_cm is null or (length_cm > 0 and length_cm <= 2000)),
  width_cm numeric(8, 1) check (width_cm is null or (width_cm > 0 and width_cm <= 2000)),
  height_cm numeric(8, 1) check (height_cm is null or (height_cm > 0 and height_cm <= 2000)),
  declared_value numeric(14, 2) not null check (declared_value >= 0 and declared_value <= 100000000),
  vehicle_type text not null check (vehicle_type in ('any', 'motorcycle', 'sedan', 'mpv_suv', 'pickup', 'l300_h100', 'closed_van', 'truck')),
  pickup_name text not null check (char_length(pickup_name) between 2 and 80),
  pickup_phone text not null check (pickup_phone ~ '^\+?[0-9]{7,13}$'),
  pickup_address text not null check (char_length(pickup_address) between 5 and 300),
  pickup_landmark text check (char_length(pickup_landmark) <= 200),
  pickup_region_code text not null references public.psgc_regions (code),
  pickup_province_code text references public.psgc_provinces (code),
  pickup_city_code text not null references public.psgc_cities (code),
  dropoff_name text not null check (char_length(dropoff_name) between 2 and 80),
  dropoff_phone text not null check (dropoff_phone ~ '^\+?[0-9]{7,13}$'),
  dropoff_address text not null check (char_length(dropoff_address) between 5 and 300),
  dropoff_landmark text check (char_length(dropoff_landmark) <= 200),
  dropoff_region_code text not null references public.psgc_regions (code),
  dropoff_province_code text references public.psgc_provinces (code),
  dropoff_city_code text not null references public.psgc_cities (code),
  pickup_at timestamptz, -- null = as soon as possible
  offered_fee numeric(10, 2) check (offered_fee is null or (offered_fee >= 0 and offered_fee <= 1000000)),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'open' check (status in ('open', 'assigned', 'picked_up', 'delivered', 'completed', 'cancelled')),
  rider_id uuid references public.profiles (id) on delete set null,
  agreed_fee numeric(10, 2),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index delivery_requests_open on public.delivery_requests (pickup_region_code, created_at desc) where status = 'open';
create index delivery_requests_requester on public.delivery_requests (requester_id, created_at desc);
create index delivery_requests_rider on public.delivery_requests (rider_id, created_at desc) where rider_id is not null;
create index delivery_requests_order on public.delivery_requests (order_id) where order_id is not null;
alter table public.delivery_requests enable row level security;
create policy delivery_read on public.delivery_requests for select using (
  requester_id = auth.uid() or rider_id = auth.uid() or public.is_admin()
  or (order_id is not null and exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())))
);
create policy delivery_insert on public.delivery_requests for insert with check (requester_id = auth.uid() and status = 'open' and rider_id is null);
-- Details can be edited only while nobody has the job yet; status changes go through update_delivery_status().
create policy delivery_update on public.delivery_requests for update using (requester_id = auth.uid() and status = 'open') with check (requester_id = auth.uid());

create or replace function public.delivery_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_not_restricted(new.requester_id);
    if (select count(*) from public.delivery_requests where requester_id = new.requester_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'Daily booking limit reached (20)' using errcode = 'P0001';
    end if;
    if new.order_id is not null and not exists (
      select 1 from public.orders o where o.id = new.order_id and (o.buyer_id = new.requester_id or o.seller_id = new.requester_id)
    ) then
      raise exception 'You can only link your own order';
    end if;
  elsif current_setting('app.delivery_fn', true) is distinct from '1' then
    -- the requester may edit the parcel and addresses while it's open, nothing about who does the job
    new.requester_id := old.requester_id; new.order_id := old.order_id; new.created_at := old.created_at;
    new.status := old.status; new.rider_id := old.rider_id; new.agreed_fee := old.agreed_fee;
    new.assigned_at := old.assigned_at; new.picked_up_at := old.picked_up_at; new.delivered_at := old.delivered_at;
    new.completed_at := old.completed_at; new.cancelled_at := old.cancelled_at; new.expires_at := old.expires_at;
  end if;
  perform public.assert_clean_text(new.item_description || ' ' || coalesce(new.notes, '') || ' ' || new.pickup_address || ' ' ||
    coalesce(new.pickup_landmark, '') || ' ' || new.dropoff_address || ' ' || coalesce(new.dropoff_landmark, ''));
  return new;
end $$;
create trigger delivery_requests_guard before insert or update on public.delivery_requests for each row execute function public.delivery_requests_guard();

-- Riders answer a booking with their fee. Only the rider and the person who booked can see it.
create table public.delivery_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  fee numeric(10, 2) not null check (fee >= 0 and fee <= 1000000),
  pickup_eta_minutes integer check (pickup_eta_minutes is null or pickup_eta_minutes between 0 and 10080),
  message text check (char_length(message) <= 500),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (request_id, rider_id)
);
create index delivery_offers_request on public.delivery_offers (request_id, created_at);
create index delivery_offers_rider on public.delivery_offers (rider_id, created_at desc);
alter table public.delivery_offers enable row level security;
create policy delivery_offers_read on public.delivery_offers for select using (
  rider_id = auth.uid() or public.is_admin() or exists (select 1 from public.delivery_requests r where r.id = request_id and r.requester_id = auth.uid())
);
create policy delivery_offers_insert on public.delivery_offers for insert with check (rider_id = auth.uid() and status = 'sent');
create policy delivery_offers_update on public.delivery_offers for update using (rider_id = auth.uid()) with check (rider_id = auth.uid());

-- The person who booked can ask a specific nearby rider to look at the job.
create table public.delivery_invites (
  request_id uuid not null references public.delivery_requests (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, rider_id)
);
create index delivery_invites_rider on public.delivery_invites (rider_id, created_at desc);
alter table public.delivery_invites enable row level security;
create policy delivery_invites_read on public.delivery_invites for select using (
  rider_id = auth.uid() or exists (select 1 from public.delivery_requests r where r.id = request_id and r.requester_id = auth.uid())
);

create or replace function public.is_active_rider(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rider_profiles where user_id = p_user and status = 'approved'
                  and license_expiry >= (now() at time zone 'Asia/Manila')::date);
$$;

create or replace function public.delivery_offers_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; v text;
begin
  select * into r from public.delivery_requests where id = new.request_id;
  if not found then raise exception 'Booking not found'; end if;
  if tg_op = 'INSERT' then
    perform public.assert_not_restricted(new.rider_id);
    if not public.is_active_rider(new.rider_id) then raise exception 'Only verified riders can send offers'; end if;
    if r.status <> 'open' or r.expires_at < now() then raise exception 'This booking already has a rider or was closed'; end if;
    if r.requester_id = new.rider_id then raise exception 'You cannot take your own booking'; end if;
    select vehicle_type into v from public.rider_profiles where user_id = new.rider_id;
    if r.vehicle_type <> 'any' and r.vehicle_type <> v then raise exception 'This booking needs a different vehicle'; end if;
    if (select count(*) from public.delivery_offers where rider_id = new.rider_id and created_at > now() - interval '1 day') >= 100 then
      raise exception 'Daily offer limit reached' using errcode = 'P0001';
    end if;
    perform public.notify(r.requester_id, 'delivery_offer',
      jsonb_build_object('name', (select full_name from public.rider_profiles where user_id = new.rider_id), 'fee', new.fee::text),
      '/delivery/' || r.id);
  elsif current_setting('app.delivery_fn', true) is distinct from '1' then
    -- riders may change their fee while waiting, or withdraw; decisions go through accept_delivery_offer()
    if old.status <> 'sent' then raise exception 'This offer was already answered'; end if;
    if new.status not in ('sent', 'withdrawn') then raise exception 'Invalid offer status'; end if;
    new.request_id := old.request_id; new.rider_id := old.rider_id; new.created_at := old.created_at;
  end if;
  perform public.assert_clean_text(coalesce(new.message, ''));
  return new;
end $$;
create trigger delivery_offers_guard before insert or update on public.delivery_offers for each row execute function public.delivery_offers_guard();

-- Posts an update card in the order's chat when a booking is linked to an order.
create or replace function public.delivery_order_card(r public.delivery_requests, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare convo uuid;
begin
  if r.order_id is null then return; end if;
  select conversation_id into convo from public.orders where id = r.order_id;
  if convo is null then return; end if;
  insert into public.messages (conversation_id, sender_id, body, is_system, system_kind, system_link)
    values (convo, r.requester_id, 'Delivery update', true, p_kind, '/delivery/' || r.id);
end $$;
revoke all on function public.delivery_order_card(public.delivery_requests, text) from public, anon, authenticated;

create or replace function public.accept_delivery_offer(p_offer uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record; r public.delivery_requests;
begin
  select * into o from public.delivery_offers where id = p_offer for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into r from public.delivery_requests where id = o.request_id for update;
  if r.requester_id is distinct from auth.uid() then raise exception 'Offer not found'; end if;
  if r.status <> 'open' then raise exception 'This booking already has a rider or was closed'; end if;
  if o.status <> 'sent' then raise exception 'This offer was already answered'; end if;
  if not public.is_active_rider(o.rider_id) then raise exception 'This rider is not available anymore'; end if;
  perform set_config('app.delivery_fn', '1', true);
  update public.delivery_offers set status = 'accepted' where id = p_offer;
  update public.delivery_offers set status = 'declined' where request_id = r.id and id <> p_offer and status = 'sent';
  update public.delivery_requests set status = 'assigned', rider_id = o.rider_id, agreed_fee = o.fee, assigned_at = now()
   where id = r.id returning * into r;
  perform public.notify(o.rider_id, 'delivery_hired', jsonb_build_object('fee', o.fee::text), '/delivery/' || r.id);
  perform public.delivery_order_card(r, 'delivery.assigned');
end $$;
revoke all on function public.accept_delivery_offer(uuid) from public, anon;
grant execute on function public.accept_delivery_offer(uuid) to authenticated;

-- Every step of a booking:
--   rider:     assigned → picked_up → delivered, or 'released' (gives the job back before pickup)
--   requester: delivered → completed (received), or cancelled before pickup
create or replace function public.update_delivery_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.delivery_requests; me uuid := auth.uid();
begin
  select * into r from public.delivery_requests where id = p_id for update;
  if not found or (me is distinct from r.requester_id and me is distinct from r.rider_id) then raise exception 'Booking not found'; end if;
  perform set_config('app.delivery_fn', '1', true);
  if me = r.rider_id and p_status = 'picked_up' and r.status = 'assigned' then
    update public.delivery_requests set status = 'picked_up', picked_up_at = now() where id = p_id returning * into r;
    perform public.notify(r.requester_id, 'delivery_picked_up', '{}', '/delivery/' || r.id);
    perform public.delivery_order_card(r, 'delivery.picked_up');
  elsif me = r.rider_id and p_status = 'delivered' and r.status = 'picked_up' then
    update public.delivery_requests set status = 'delivered', delivered_at = now() where id = p_id returning * into r;
    perform public.notify(r.requester_id, 'delivery_delivered', '{}', '/delivery/' || r.id);
    perform public.delivery_order_card(r, 'delivery.delivered');
  elsif me = r.rider_id and p_status = 'released' and r.status = 'assigned' then
    update public.delivery_offers set status = 'withdrawn' where request_id = p_id and rider_id = me;
    update public.delivery_requests set status = 'open', rider_id = null, agreed_fee = null, assigned_at = null,
           expires_at = greatest(expires_at, now() + interval '3 days')
     where id = p_id;
    perform public.notify(r.requester_id, 'delivery_released', '{}', '/delivery/' || r.id);
  elsif me = r.requester_id and p_status = 'completed' and r.status = 'delivered' then
    update public.delivery_requests set status = 'completed', completed_at = now() where id = p_id;
    perform public.notify(r.rider_id, 'delivery_completed', '{}', '/delivery/' || r.id);
  elsif me = r.requester_id and p_status = 'cancelled' and r.status in ('open', 'assigned') then
    update public.delivery_requests set status = 'cancelled', cancelled_at = now() where id = p_id returning * into r;
    update public.delivery_offers set status = 'declined' where request_id = p_id and status = 'sent';
    if r.rider_id is not null then perform public.notify(r.rider_id, 'delivery_cancelled', '{}', '/delivery/' || r.id); end if;
  else
    raise exception 'This step is not allowed right now';
  end if;
end $$;
revoke all on function public.update_delivery_status(uuid, text) from public, anon;
grant execute on function public.update_delivery_status(uuid, text) to authenticated;

create or replace function public.invite_rider(p_request uuid, p_rider uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.delivery_requests where id = p_request;
  if not found or r.requester_id is distinct from auth.uid() then raise exception 'Booking not found'; end if;
  if r.status <> 'open' then raise exception 'This booking already has a rider or was closed'; end if;
  if not public.is_active_rider(p_rider) then raise exception 'This rider is not available anymore'; end if;
  if (select count(*) from public.delivery_invites where request_id = p_request) >= 15 then
    raise exception 'You can ask up to 15 riders per booking';
  end if;
  insert into public.delivery_invites (request_id, rider_id) values (p_request, p_rider) on conflict do nothing;
  if found then
    perform public.notify(p_rider, 'delivery_invite', jsonb_build_object('city', (select name from public.psgc_cities where code = r.pickup_city_code)), '/delivery/' || p_request);
  end if;
end $$;
revoke all on function public.invite_rider(uuid, uuid) from public, anon;
grant execute on function public.invite_rider(uuid, uuid) to authenticated;

/* ───────── Safe public views ───────── */

-- Verified riders, nearest first: same city, then same province, then same region. Only first name + last initial.
create or replace function public.public_riders(p_region text default null, p_province text default null, p_city text default null,
                                                p_vehicle text default null, p_limit integer default 24, p_ids uuid[] default null)
returns table (user_id uuid, name text, avatar_url text, vehicle_type text, vehicle_model text, city text, province text,
               region_code text, is_available boolean, completed integer, nearness integer)
language sql stable security definer set search_path = public as $$
  select rp.user_id,
         split_part(rp.full_name, ' ', 1) || case when position(' ' in rp.full_name) > 0
           then ' ' || left(regexp_replace(rp.full_name, '^.* ', ''), 1) || '.' else '' end,
         p.avatar_url, rp.vehicle_type, rp.vehicle_model, c.name, pr.name, rp.region_code, rp.is_available,
         (select count(*)::int from public.delivery_requests d where d.rider_id = rp.user_id and d.status = 'completed'),
         case when p_city is not null and rp.city_code = p_city then 0
              when p_province is not null and rp.province_code = p_province then 1
              when p_region is not null and rp.region_code = p_region then 2 else 3 end
    from public.rider_profiles rp
    join public.profiles p on p.id = rp.user_id
    left join public.psgc_cities c on c.code = rp.city_code
    left join public.psgc_provinces pr on pr.code = rp.province_code
   where rp.status = 'approved' and rp.license_expiry >= (now() at time zone 'Asia/Manila')::date
     and (p_ids is null or rp.user_id = any (p_ids))
     and (p_ids is not null or rp.is_available)
     and (p_vehicle is null or p_vehicle = 'any' or rp.vehicle_type = p_vehicle)
     and (p_ids is not null or p_region is null or rp.region_code = p_region)
   order by 11, 10 desc, rp.reviewed_at desc nulls last
   limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;
grant execute on function public.public_riders(text, text, text, text, integer, uuid[]) to anon, authenticated;

-- What other riders may see of a booking: no names, exact addresses or phone numbers.
create or replace function public.open_deliveries(p_region text default null, p_id uuid default null, p_limit integer default 30)
returns table (id uuid, item_description text, quantity integer, weight_per_piece_kg numeric, total_weight_kg numeric,
               length_cm numeric, width_cm numeric, height_cm numeric, declared_value numeric, vehicle_type text,
               pickup_city text, pickup_province text, pickup_region_code text, dropoff_city text, dropoff_province text,
               pickup_at timestamptz, offered_fee numeric, notes text, status text, created_at timestamptz, invited boolean)
language sql stable security definer set search_path = public as $$
  select d.id, d.item_description, d.quantity, d.weight_per_piece_kg, d.total_weight_kg, d.length_cm, d.width_cm, d.height_cm,
         d.declared_value, d.vehicle_type, pc.name, pp.name, d.pickup_region_code, dc.name, dp.name,
         d.pickup_at, d.offered_fee, d.notes, d.status, d.created_at,
         exists (select 1 from public.delivery_invites i where i.request_id = d.id and i.rider_id = auth.uid())
    from public.delivery_requests d
    left join public.psgc_cities pc on pc.code = d.pickup_city_code
    left join public.psgc_provinces pp on pp.code = d.pickup_province_code
    left join public.psgc_cities dc on dc.code = d.dropoff_city_code
    left join public.psgc_provinces dp on dp.code = d.dropoff_province_code
   where public.is_active_rider(auth.uid())
     and d.status = 'open' and d.expires_at > now() and d.requester_id <> auth.uid()
     and (p_id is null or d.id = p_id)
     and (p_region is null or d.pickup_region_code = p_region)
     and (d.vehicle_type = 'any' or d.vehicle_type = (select vehicle_type from public.rider_profiles where user_id = auth.uid()))
   order by 21 desc, d.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;
revoke all on function public.open_deliveries(text, uuid, integer) from public, anon;
grant execute on function public.open_deliveries(text, uuid, integer) to authenticated;

-- Contact details of the rider who got the job, for the person who booked and the buyer/seller of a linked order.
create or replace function public.delivery_rider_contact(p_id uuid)
returns table (full_name text, phone text, plate_number text, vehicle_type text, vehicle_model text)
language sql stable security definer set search_path = public as $$
  select rp.full_name, rp.phone, rp.plate_number, rp.vehicle_type, rp.vehicle_model
    from public.delivery_requests d join public.rider_profiles rp on rp.user_id = d.rider_id
   where d.id = p_id and d.status in ('assigned', 'picked_up', 'delivered', 'completed')
     and (d.requester_id = auth.uid() or public.is_admin()
          or (d.order_id is not null and exists (select 1 from public.orders o where o.id = d.order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid()))));
$$;
revoke all on function public.delivery_rider_contact(uuid) from public, anon;
grant execute on function public.delivery_rider_contact(uuid) to authenticated;
