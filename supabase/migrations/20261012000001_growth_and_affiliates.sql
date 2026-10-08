-- Phase 5: Growth & Integrations
--   • listing cap per FLAME tier        • affiliate links (seller approves each affiliate, per listing)
--   • storefront links + featured stores • feed / embed gating helper • FLAME PH membership sync
-- The platform never touches money here: commissions are only RECORDED; sellers pay affiliates outside the platform.

-- ───────────────────────── Listing cap by tier ─────────────────────────
-- Counts the owner's non-removed listings across their stores. Enforced for signed-in users only (seeds / service role are exempt).
create or replace function public.listings_cap_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; lim integer; used integer;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'UPDATE' and (new.status = 'removed' or old.status <> 'removed') then return new; end if;   -- only re-activating a removed one counts as new
  select owner_id into owner from public.stores where id = new.store_id;
  select t.listing_limit into lim from public.plan_tiers t where t.rank = public._tier_rank(owner);
  if lim is null then return new; end if;
  select count(*) into used from public.listings l join public.stores s on s.id = l.store_id
   where s.owner_id = owner and l.status <> 'removed' and (tg_op = 'INSERT' or l.id <> new.id);
  if used >= lim then
    raise exception 'Your plan allows % listings. Upgrade your FLAME membership to post more.', lim using errcode = 'P0003';
  end if;
  return new;
end $$;
create trigger listings_cap_t before insert or update of status on public.listings
  for each row execute function public.listings_cap_guard();

create or replace function public.listing_usage() returns table (used integer, listing_limit integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.listings l join public.stores s on s.id = l.store_id where s.owner_id = auth.uid() and l.status <> 'removed'),
         (select t.listing_limit from public.plan_tiers t where t.rank = public._tier_rank(auth.uid()));
$$;

-- ───────────────────────── Storefront links ─────────────────────────
alter table public.stores add column website_url text check (website_url is null or (char_length(website_url) <= 200 and website_url ~* '^https?://'));
alter table public.stores add constraint stores_facebook_url_chk check (facebook_url is null or (char_length(facebook_url) <= 200 and facebook_url ~* '^https?://'));

-- Is this store's owner on at least tier p_min? (boolean only — never reveals the plan itself.) Used to gate the public feed / embed.
create or replace function public.store_has_tier(p_store uuid, p_min integer) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public._tier_rank(s.owner_id) >= p_min from public.stores s where s.id = p_store), false);
$$;

-- Champion stores get a "Featured" spot (premium visibility). Order is stable-random so every Champion gets a turn.
create or replace function public.featured_stores(p_limit integer default 6) returns table (store_id uuid)
language sql stable security definer set search_path = public as $$
  select s.id from public.stores s
   where public._tier_rank(s.owner_id) >= 5
   order by md5(s.id::text || current_date::text) limit least(greatest(p_limit, 1), 12);
$$;

-- ───────────────────────── Affiliates ─────────────────────────
alter table public.listings add column commission_pct numeric(4, 1) check (commission_pct is null or (commission_pct >= 1 and commission_pct <= 50));
comment on column public.listings.commission_pct is 'Null = no affiliate commission on this listing. Set by the seller.';

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  affiliate_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  rate numeric(4, 1),                       -- snapshot of the listing's commission at approval time
  message text check (char_length(message) <= 300),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (affiliate_id, listing_id)
);
create index affiliate_links_seller on public.affiliate_links (seller_id, status);
create index affiliate_links_affiliate on public.affiliate_links (affiliate_id);

create table public.affiliate_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.affiliate_links (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index affiliate_clicks_link on public.affiliate_clicks (link_id, created_at);

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  link_id uuid not null references public.affiliate_links (id) on delete cascade,
  affiliate_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  rate numeric(4, 1) not null,
  amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'earned', 'paid', 'void')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, link_id)
);
create index affiliate_commissions_affiliate on public.affiliate_commissions (affiliate_id, status);
create index affiliate_commissions_seller on public.affiliate_commissions (seller_id, status);

alter table public.affiliate_links enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_commissions enable row level security;
create policy aff_links_read on public.affiliate_links for select using (affiliate_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy aff_clicks_read on public.affiliate_clicks for select
  using (exists (select 1 from public.affiliate_links l where l.id = link_id and (l.affiliate_id = auth.uid() or l.seller_id = auth.uid())));
create policy aff_comm_read on public.affiliate_commissions for select using (affiliate_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
-- no insert/update/delete policies: everything goes through the functions below.

create or replace function public.affiliate_quota() returns table (used integer, quota integer)
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.affiliate_links where affiliate_id = auth.uid() and status in ('pending', 'approved')),
         (select t.affiliate_links from public.plan_tiers t where t.rank = public._tier_rank(auth.uid()));
$$;

-- An affiliate asks to promote a listing. The seller must approve this affiliate before the link earns anything.
create or replace function public.request_affiliate_link(p_listing uuid, p_message text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l record; s record; v_used int; v_quota int; lid uuid; existing record; had boolean;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  perform public.assert_not_restricted(uid);
  select li.*, st.owner_id as owner_id, st.name as store_name into l from public.listings li join public.stores st on st.id = li.store_id where li.id = p_listing and li.status = 'active';
  if not found then raise exception 'Listing not found'; end if;
  if l.commission_pct is null then raise exception 'This seller has not enabled commissions on this listing'; end if;
  if l.owner_id = uid then raise exception 'You cannot be an affiliate for your own listing'; end if;
  select * into existing from public.affiliate_links where affiliate_id = uid and listing_id = p_listing;
  had := found;   -- later SELECTs would overwrite FOUND
  if had and existing.status in ('pending', 'approved') then return existing.id; end if;
  if had and existing.status = 'rejected' then raise exception 'The seller declined this request' using errcode = 'P0001'; end if;
  select a.used, a.quota into v_used, v_quota from public.affiliate_quota() a;
  if v_used >= v_quota then
    raise exception 'Your plan allows % affiliate links. Upgrade your FLAME membership for more.', v_quota using errcode = 'P0003';
  end if;
  if had then   -- a revoked link can be re-requested
    update public.affiliate_links set status = 'pending', message = left(nullif(trim(p_message), ''), 300), decided_at = null, rate = null where id = existing.id returning id into lid;
  else
    insert into public.affiliate_links (affiliate_id, listing_id, seller_id, message) values (uid, p_listing, l.owner_id, left(nullif(trim(p_message), ''), 300)) returning id into lid;
  end if;
  perform public.notify(l.owner_id, 'affiliate_requested', jsonb_build_object('listing', left(l.title, 60)), '/business/affiliates');
  return lid;
end $$;

create or replace function public.decide_affiliate_link(p_link uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); k record; l record;
begin
  select * into k from public.affiliate_links where id = p_link and seller_id = uid and status = 'pending' for update;
  if not found then raise exception 'Request not found'; end if;
  select * into l from public.listings where id = k.listing_id;
  if p_approve and l.commission_pct is null then raise exception 'Set a commission on the listing first'; end if;
  update public.affiliate_links set status = case when p_approve then 'approved' else 'rejected' end,
         rate = case when p_approve then l.commission_pct end, decided_at = now() where id = p_link;
  perform public.notify(k.affiliate_id, case when p_approve then 'affiliate_approved' else 'affiliate_rejected' end,
    jsonb_build_object('listing', left(l.title, 60)), '/business/affiliates');
end $$;

-- Seller (or the affiliate themself) ends a link. Orders already attributed keep their commission.
create or replace function public.revoke_affiliate_link(p_link uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  update public.affiliate_links set status = 'revoked', decided_at = now()
   where id = p_link and (seller_id = uid or affiliate_id = uid) and status in ('pending', 'approved');
  if not found then raise exception 'Link not found'; end if;
end $$;

-- Called by the app right after place_order, with the code from the buyer's referral cookie.
-- Silent no-op when the code is invalid, not approved, or does not match an item in the order.
create or replace function public.attach_affiliate(p_order uuid, p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o record; k record;
begin
  select * into o from public.orders where id = p_order and buyer_id = uid and is_full_flow and status = 'requested';
  if not found then return false; end if;
  select * into k from public.affiliate_links where code = lower(trim(p_code)) and status = 'approved';
  if not found or k.affiliate_id = uid or k.seller_id <> o.seller_id then return false; end if;
  if not exists (select 1 from public.order_items where order_id = p_order and listing_id = k.listing_id) then return false; end if;
  insert into public.affiliate_commissions (order_id, link_id, affiliate_id, seller_id, listing_id, rate)
    values (p_order, k.id, k.affiliate_id, k.seller_id, k.listing_id, coalesce(k.rate, 0)) on conflict do nothing;
  return true;
end $$;

-- Records a click. Called by the redirect route (service role), not by browsers.
create or replace function public.record_affiliate_click(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select l.id, l.listing_id into k from public.affiliate_links l where l.code = lower(trim(p_code)) and l.status = 'approved';
  if not found then return null; end if;
  insert into public.affiliate_clicks (link_id) values (k.id);
  return k.listing_id;
end $$;

-- Order finished → commission becomes "earned" (amount = rate × the affiliate-listing lines); cancelled → "void".
create or replace function public.commission_settle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'completed' then
    update public.affiliate_commissions c set status = 'earned',
           amount = round(coalesce((select sum(coalesce(i.available_qty, i.quantity) * coalesce(i.unit_price, 0)) from public.order_items i where i.order_id = c.order_id and i.listing_id = c.listing_id), 0) * c.rate / 100, 2)
     where c.order_id = new.id and c.status = 'pending';
    insert into public.notifications (user_id, kind, params, link)
      select c.affiliate_id, 'commission_earned', jsonb_build_object('amount', c.amount), '/business/affiliates' from public.affiliate_commissions c where c.order_id = new.id and c.status = 'earned';
  elsif new.status = 'cancelled' then
    update public.affiliate_commissions set status = 'void' where order_id = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger orders_commission_t after update of status on public.orders
  for each row execute function public.commission_settle();

-- The seller records that they paid the affiliate (outside the platform).
create or replace function public.mark_commission_paid(p_commission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c record;
begin
  update public.affiliate_commissions set status = 'paid', paid_at = now() where id = p_commission and seller_id = uid and status = 'earned' returning * into c;
  if not found then raise exception 'Commission not found or not yet earned'; end if;
  perform public.notify(c.affiliate_id, 'commission_paid', jsonb_build_object('amount', c.amount), '/business/affiliates');
end $$;

-- Seller: change the commission on a listing. Existing approved links keep the rate they were approved at.
create or replace function public.set_listing_commission(p_listing uuid, p_pct numeric default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pct is not null and (p_pct < 1 or p_pct > 50) then raise exception 'Commission must be between 1%% and 50%%'; end if;
  update public.listings l set commission_pct = p_pct from public.stores s where l.id = p_listing and s.id = l.store_id and s.owner_id = auth.uid();
  if not found then raise exception 'Listing not found'; end if;
end $$;

-- Affiliate dashboard: per link totals.
create or replace function public.affiliate_dashboard()
returns table (link_id uuid, code text, status text, listing_id uuid, listing_title text, store_name text, rate numeric, clicks bigint, orders bigint, pending numeric, earned numeric, paid numeric)
language sql stable security definer set search_path = public as $$
  select k.id, k.code, k.status, k.listing_id, li.title, st.name, k.rate,
         (select count(*) from public.affiliate_clicks c where c.link_id = k.id),
         (select count(*) from public.affiliate_commissions m where m.link_id = k.id and m.status <> 'void'),
         coalesce((select sum(m.amount) from public.affiliate_commissions m where m.link_id = k.id and m.status = 'pending'), 0),
         coalesce((select sum(m.amount) from public.affiliate_commissions m where m.link_id = k.id and m.status = 'earned'), 0),
         coalesce((select sum(m.amount) from public.affiliate_commissions m where m.link_id = k.id and m.status = 'paid'), 0)
    from public.affiliate_links k join public.listings li on li.id = k.listing_id join public.stores st on st.id = li.store_id
   where k.affiliate_id = auth.uid() order by k.created_at desc;
$$;

-- ───────────────────────── FLAME PH membership sync (server-to-server only) ─────────────────────────
-- Called from /api/flame/membership with a shared secret using the service-role key. Matches the member by email.
create or replace function public.sync_membership(p_email text, p_tier text, p_billing text default null, p_period_end timestamptz default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return false; end if;
  if p_tier = 'apprentice' then
    update public.subscriptions set status = 'cancelled', updated_at = now() where user_id = uid and source = 'flame';
    return true;
  end if;
  if not exists (select 1 from public.plan_tiers where key = p_tier) then raise exception 'Unknown plan'; end if;
  insert into public.subscriptions (user_id, plan, billing, status, current_period_end, source)
    values (uid, p_tier, p_billing, 'active', p_period_end, 'flame')
  on conflict (user_id) do update set plan = excluded.plan, billing = excluded.billing, status = 'active', current_period_end = excluded.current_period_end,
    source = 'flame', updated_at = now();
  update public.plan_requests set status = 'handled' where user_id = uid and status = 'open';
  perform public.notify(uid, 'plan_activated', jsonb_build_object('plan', (select name from public.plan_tiers where key = p_tier)), '/business/plan');
  return true;
end $$;

-- ───────────────────────── Grants ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'listing_usage()', 'affiliate_quota()', 'request_affiliate_link(uuid, text)', 'decide_affiliate_link(uuid, boolean)', 'revoke_affiliate_link(uuid)',
    'attach_affiliate(uuid, text)', 'mark_commission_paid(uuid)', 'set_listing_commission(uuid, numeric)', 'affiliate_dashboard()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- public, read-only helpers
  foreach f in array array['store_has_tier(uuid, integer)', 'featured_stores(integer)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  -- service role only
  foreach f in array array['record_affiliate_click(text)', 'sync_membership(text, text, text, timestamptz)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
