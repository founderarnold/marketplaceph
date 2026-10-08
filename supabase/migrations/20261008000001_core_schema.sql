-- MarketplacePH — Phase 1 core schema.
-- Principles: RLS on every table, minimal data collection, phone numbers never public,
-- all admin actions audit-logged, abuse limits enforced in the database.

create extension if not exists pg_trgm;

-- ───────────────────────── Enums ─────────────────────────
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.seller_type as enum
  ('manufacturer', 'direct_importer', 'distributor', 'reseller', 'retailer', 'service_provider');
create type public.listing_kind as enum ('product', 'service');
create type public.price_type as enum ('fixed', 'range', 'message');
create type public.stock_status as enum ('in_stock', 'made_to_order', 'pre_order', 'out_of_stock');
create type public.listing_status as enum ('active', 'hidden', 'removed');
create type public.report_status as enum ('open', 'reviewing', 'dismissed', 'actioned');
create type public.report_target as enum ('listing', 'store', 'user', 'message');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── Profiles ─────────────────────────
-- phone/email live only here; profiles are readable by owner + admins.
-- Other users see only public_profiles (id, display_name, avatar_url).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'New user' check (char_length(display_name) between 1 and 80),
  avatar_url text,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'fil')),
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator'));
$$;

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'New user'),
    new.phone
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users must not be able to promote themselves.
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    -- allow service-role / SQL console (no auth.uid())
    if auth.uid() is not null then
      raise exception 'Only admins can change roles';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

create view public.public_profiles as
  select id, display_name, avatar_url, created_at from public.profiles;
grant select on public.public_profiles to anon, authenticated;

-- ───────────────────────── PSGC reference data ─────────────────────────
create table public.psgc_regions (code text primary key, name text not null, short_name text not null);
create table public.psgc_provinces (
  code text primary key, region_code text not null references public.psgc_regions (code), name text not null
);
create table public.psgc_cities (
  code text primary key,
  region_code text not null references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  name text not null
);
create index psgc_provinces_region on public.psgc_provinces (region_code);
create index psgc_cities_region on public.psgc_cities (region_code);
create index psgc_cities_province on public.psgc_cities (province_code);

-- ───────────────────────── Stores ─────────────────────────
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 80),
  tagline text check (char_length(tagline) <= 160),
  description text check (char_length(description) <= 2000),
  logo_url text,
  seller_type public.seller_type not null,
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  address_note text check (char_length(address_note) <= 200),
  -- Contact details shown on the storefront are opt-in by the seller.
  contact_phone text,
  contact_email text,
  facebook_url text,
  year_started smallint check (year_started between 1900 and 2100),
  -- 0 none, 1 phone, 2 ID, 3 business (Phase 2 will drive this from store_verifications)
  verification_level smallint not null default 0 check (verification_level between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_owner on public.stores (owner_id);
create index stores_region on public.stores (region_code);
create trigger stores_updated before update on public.stores
  for each row execute function public.set_updated_at();

-- verification_level is admin-controlled, never user-editable.
create or replace function public.protect_store_verification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then new.verification_level = 0;
    elsif new.verification_level is distinct from old.verification_level then
      raise exception 'Only admins can change verification level';
    end if;
  end if;
  return new;
end $$;
create trigger stores_protect_verification before insert or update on public.stores
  for each row execute function public.protect_store_verification();

-- ───────────────────────── Categories ─────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  slug text not null unique,
  name_en text not null,
  name_fil text not null,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- Banned / prohibited items: listings matching these words are rejected on write.
create table public.banned_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  reason text not null
);

-- ───────────────────────── Listings ─────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  category_id uuid references public.categories (id),
  kind public.listing_kind not null default 'product',
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 5000),
  price_type public.price_type not null default 'fixed',
  price_min numeric(12, 2) check (price_min >= 0),
  price_max numeric(12, 2) check (price_max >= 0),
  unit text not null default 'pc' check (char_length(unit) <= 20),
  moq integer not null default 1 check (moq >= 1),
  stock_status public.stock_status not null default 'in_stock',
  quantity_on_hand integer check (quantity_on_hand >= 0),
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  status public.listing_status not null default 'active',
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_consistency check (
    (price_type = 'message' and price_min is null and price_max is null)
    or (price_type = 'fixed' and price_min is not null and price_max is null)
    or (price_type = 'range' and price_min is not null and price_max is not null and price_max >= price_min)
  )
);
create index listings_store on public.listings (store_id);
create index listings_category on public.listings (category_id);
create index listings_region on public.listings (region_code, province_code, city_code);
create index listings_active_created on public.listings (created_at desc) where status = 'active';
create index listings_title_trgm on public.listings using gin (title gin_trgm_ops);
create trigger listings_updated before update on public.listings
  for each row execute function public.set_updated_at();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- storage object path in bucket "listing-images", or an absolute/site-relative URL (seed data)
  path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index listing_images_listing on public.listing_images (listing_id, position);

create table public.listing_price_tiers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  min_qty integer not null check (min_qty >= 2),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unique (listing_id, min_qty)
);

-- Auto "Out of stock" at zero quantity (spec: inventory auto-flag).
create or replace function public.listing_stock_rules() returns trigger
language plpgsql as $$
begin
  if new.quantity_on_hand is not null and new.quantity_on_hand = 0 and new.stock_status = 'in_stock' then
    new.stock_status = 'out_of_stock';
  end if;
  return new;
end $$;
create trigger listings_stock_rules before insert or update on public.listings
  for each row execute function public.listing_stock_rules();

-- Reject banned items and limit posting volume (anti-spam).
create or replace function public.listing_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare hit record; recent int;
begin
  select keyword, reason into hit from public.banned_keywords
   where lower(new.title || ' ' || coalesce(new.description, '')) like '%' || lower(keyword) || '%' limit 1;
  if found then
    raise exception 'This item cannot be listed (%): %', hit.keyword, hit.reason using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    select count(*) into recent from public.listings l join public.stores s on s.id = l.store_id
     where s.owner_id = auth.uid() and l.created_at > now() - interval '1 day';
    if recent >= 100 then raise exception 'Daily listing limit reached' using errcode = 'P0001'; end if;
  end if;
  return new;
end $$;
create trigger listings_guard before insert or update of title, description on public.listings
  for each row execute function public.listing_guard();

-- Public view count bump without opening up UPDATE on listings.
create or replace function public.bump_listing_view(p_listing uuid) returns void
language sql security definer set search_path = public as $$
  update public.listings set view_count = view_count + 1 where id = p_listing and status = 'active';
$$;
grant execute on function public.bump_listing_view(uuid) to anon, authenticated;

-- ───────────────────────── Favorites ─────────────────────────
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((listing_id is not null)::int + (store_id is not null)::int = 1)
);
create unique index favorites_unique_listing on public.favorites (user_id, listing_id) where listing_id is not null;
create unique index favorites_unique_store on public.favorites (user_id, store_id) where store_id is not null;

-- ───────────────────────── Chat ─────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index conversations_unique on public.conversations
  (buyer_id, store_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index conversations_store on public.conversations (store_id, last_message_at desc);
create index conversations_buyer on public.conversations (buyer_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text check (char_length(body) between 1 and 2000),
  image_path text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or image_path is not null)
);
create index messages_conversation on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c join public.stores s on s.id = c.store_id
     where c.id = p_conv and (c.buyer_id = auth.uid() or s.owner_id = auth.uid())
  );
$$;

-- Rate limit messaging, bump conversation activity.
create or replace function public.message_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.messages
   where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'You are sending messages too fast. Please wait a moment.' using errcode = 'P0001'; end if;
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_guard before insert on public.messages
  for each row execute function public.message_guard();

create or replace function public.mark_conversation_read(p_conv uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
   where conversation_id = p_conv and sender_id <> auth.uid() and read_at is null
     and public.is_conversation_participant(p_conv);
$$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ───────────────────────── Reports (Phase 1: private intake only) ─────────────────────────
-- Nothing here is ever shown publicly. Public flags arrive in Phase 2 with due process.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (reason in ('scam', 'fake_item', 'prohibited_item', 'harassment', 'spam', 'wrong_info', 'other')),
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  admin_note text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_status on public.reports (status, created_at desc);
create trigger reports_updated before update on public.reports
  for each row execute function public.set_updated_at();

create or replace function public.report_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.reports
   where reporter_id = new.reporter_id and created_at > now() - interval '1 day';
  if recent >= 10 then raise exception 'Daily report limit reached' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger reports_guard before insert on public.reports
  for each row execute function public.report_guard();

-- ───────────────────────── Audit log ─────────────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created on public.audit_logs (created_at desc);

-- Log every change made by an admin/moderator account on moderated tables.
create or replace function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.is_admin() then
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (
      auth.uid(), tg_op, tg_table_name,
      coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  end if;
  return coalesce(new, old);
end $$;
create trigger audit_listings after insert or update or delete on public.listings
  for each row execute function public.log_admin_change();
create trigger audit_stores after insert or update or delete on public.stores
  for each row execute function public.log_admin_change();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.log_admin_change();
create trigger audit_banned after insert or update or delete on public.banned_keywords
  for each row execute function public.log_admin_change();
create trigger audit_reports after update or delete on public.reports
  for each row execute function public.log_admin_change();
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function public.log_admin_change();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.psgc_regions enable row level security;
alter table public.psgc_provinces enable row level security;
alter table public.psgc_cities enable row level security;
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.banned_keywords enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_price_tiers enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- profiles
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update using (public.is_admin());

-- reference data: world-readable, admin-managed
create policy psgc_regions_read on public.psgc_regions for select using (true);
create policy psgc_provinces_read on public.psgc_provinces for select using (true);
create policy psgc_cities_read on public.psgc_cities for select using (true);

-- stores
create policy stores_read on public.stores for select using (true);
create policy stores_insert on public.stores for insert with check (owner_id = auth.uid());
create policy stores_update on public.stores for update using (owner_id = auth.uid() or public.is_admin());
create policy stores_delete on public.stores for delete using (owner_id = auth.uid() or public.is_admin());

-- categories / banned keywords
create policy categories_read on public.categories for select using (true);
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy banned_admin on public.banned_keywords for all using (public.is_admin()) with check (public.is_admin());

-- listings
create policy listings_read on public.listings for select using (
  status = 'active'
  or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  or public.is_admin()
);
create policy listings_insert on public.listings for insert with check (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy listings_update on public.listings for update using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()) or public.is_admin()
);
create policy listings_delete on public.listings for delete using (
  exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()) or public.is_admin()
);

-- Sellers cannot undo an admin takedown.
create or replace function public.protect_removed_listing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'removed' and new.status <> 'removed' and auth.uid() is not null and not public.is_admin() then
    raise exception 'This listing was removed by a moderator';
  end if;
  if new.status = 'removed' and old.status <> 'removed' and auth.uid() is not null and not public.is_admin() then
    new.status = 'hidden'; -- sellers can hide, only moderators can "remove"
  end if;
  return new;
end $$;
create trigger listings_protect_removed before update on public.listings
  for each row execute function public.protect_removed_listing();

-- listing_images / tiers follow their listing
create policy listing_images_read on public.listing_images for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy listing_images_write on public.listing_images for all using (
  exists (select 1 from public.listings l join public.stores s on s.id = l.store_id
          where l.id = listing_id and (s.owner_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.listings l join public.stores s on s.id = l.store_id
          where l.id = listing_id and s.owner_id = auth.uid())
);
create policy tiers_read on public.listing_price_tiers for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy tiers_write on public.listing_price_tiers for all using (
  exists (select 1 from public.listings l join public.stores s on s.id = l.store_id
          where l.id = listing_id and (s.owner_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.listings l join public.stores s on s.id = l.store_id
          where l.id = listing_id and s.owner_id = auth.uid())
);

-- favorites: strictly personal
create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- conversations / messages: participants only (admins can read for moderation, which is audit-worthy)
create policy conversations_read on public.conversations for select using (
  buyer_id = auth.uid() or exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy conversations_insert on public.conversations for insert with check (
  buyer_id = auth.uid()
  and not exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy messages_read on public.messages for select using (public.is_conversation_participant(conversation_id));
create policy messages_insert on public.messages for insert with check (
  sender_id = auth.uid() and public.is_conversation_participant(conversation_id)
);

-- reports: reporter sees own; admins see and resolve all
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin());

-- audit logs: admins read; rows are only written by SECURITY DEFINER triggers
create policy audit_read on public.audit_logs for select using (public.is_admin());

-- ───────────────────────── Realtime ─────────────────────────
alter publication supabase_realtime add table public.messages;

-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('listing-images', 'listing-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('store-assets', 'store-assets', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-images', 'chat-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  -- Phase 2: ID / business documents. Admin-only; no user policies by design.
  ('private-docs', 'private-docs', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Files live under "<user_id>/..." so ownership is checkable from the path.
create policy "public read listing images" on storage.objects for select using (bucket_id = 'listing-images');
create policy "public read store assets" on storage.objects for select using (bucket_id = 'store-assets');
create policy "own upload listing images" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own delete listing images" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own upload store assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own update store assets" on storage.objects for update to authenticated
  using (bucket_id = 'store-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own upload chat images" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "chat participants read chat images" on storage.objects for select to authenticated
  using (bucket_id = 'chat-images' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.image_path = name and public.is_conversation_participant(m.conversation_id))
  ));
