-- MarketplacePH — Phase 4: Business tools (MSME-first).
-- Seller CRM, buyer supplier database, restock reminders / follow-ups, reports, simple finance, inventory.
-- Plan gating (the FLAME PH membership tiers) is enforced HERE, in the database, so no client can bypass it.
-- There is no payment provider yet: admins grant a tier manually (see admin_set_plan), or FLAME PH syncs it (sync_membership). SMS is queued, not sent, until a provider is connected.

-- ───────────────────────── Plans = FLAME PH membership tiers ─────────────────────────
-- Apprentice (free) → Starter → Micro → Neo → Pro → Champion. Each paid tier unlocks more.
-- The numbers below (post limits, affiliate-link limits) are the single source of truth; lib/plans.ts mirrors them (a test keeps them in sync).
create table public.plan_tiers (
  key text primary key,
  rank smallint not null unique,
  name text not null,
  monthly_php integer not null check (monthly_php >= 0),
  yearly_php integer not null check (yearly_php >= 0),
  listing_limit integer check (listing_limit > 0),          -- null = unlimited
  affiliate_links integer not null check (affiliate_links >= 0),
  tagline text not null
);
insert into public.plan_tiers (key, rank, name, monthly_php, yearly_php, listing_limit, affiliate_links, tagline) values
  ('apprentice', 0, 'FLAME Apprentice', 0, 0, 10, 3, 'Limited product posting to 10 posts'),
  ('starter', 1, 'FLAME Starter', 30, 300, 30, 5, 'Basic selling'),
  ('micro', 2, 'FLAME Micro', 60, 600, 100, 10, 'Enhanced selling'),
  ('neo', 3, 'FLAME Neo', 120, 1200, 300, 25, 'Growth tools'),
  ('pro', 4, 'FLAME Pro', 360, 3600, 1000, 50, 'Professional business tools'),
  ('champion', 5, 'FLAME Champion', 720, 7700, null, 200, 'Premium growth & visibility');
alter table public.plan_tiers enable row level security;
create policy plan_tiers_read on public.plan_tiers for select using (true);

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'starter' references public.plan_tiers (key) check (plan <> 'apprentice'),
  billing text check (billing in ('monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  current_period_end timestamptz,           -- null = no end date (e.g. granted by an admin)
  source text not null default 'admin' check (source in ('admin', 'flame')),
  granted_by uuid references public.profiles (id),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null default 'pro' references public.plan_tiers (key) check (plan <> 'apprentice'),
  billing text not null default 'monthly' check (billing in ('monthly', 'yearly')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'handled')),
  created_at timestamptz not null default now()
);
create unique index plan_requests_one_open on public.plan_requests (user_id) where status = 'open';

-- 0 = Apprentice (no active paid plan). Internal: not callable through the API.
create or replace function public._tier_rank(p_user uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select t.rank from public.subscriptions s join public.plan_tiers t on t.key = s.plan
                    where s.user_id = p_user and s.status = 'active' and (s.current_period_end is null or s.current_period_end > now())), 0)::int;
$$;
revoke all on function public._tier_rank(uuid) from public, anon, authenticated;

create or replace function public.my_tier()
returns table (tier text, rank integer, name text, listing_limit integer, affiliate_links integer, period_end timestamptz, billing text)
language sql stable security definer set search_path = public as $$
  select t.key, t.rank::int, t.name, t.listing_limit, t.affiliate_links, s.current_period_end, s.billing
    from public.plan_tiers t
    left join public.subscriptions s on s.user_id = auth.uid() and s.status = 'active' and (s.current_period_end is null or s.current_period_end > now())
   where t.rank = public._tier_rank(auth.uid());
$$;

create or replace function public.assert_tier(p_min integer) returns void
language plpgsql stable security definer set search_path = public as $$
declare nm text;
begin
  if public._tier_rank(auth.uid()) < p_min then
    select name into nm from public.plan_tiers where rank = p_min;
    raise exception 'This feature needs % or higher. Subscribe to enable it.', nm using errcode = 'P0003';
  end if;
end $$;

-- Apprentice accounts get summaries over at most 31 days; any longer range needs Starter or higher.
create or replace function public._range_ok(p_from date, p_to date) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Invalid date range'; end if;
  if (p_to - p_from) > 31 and public._tier_rank(auth.uid()) < 1 then
    raise exception 'Date ranges longer than 31 days need FLAME Starter or higher. Subscribe to enable it.' using errcode = 'P0003';
  end if;
end $$;
revoke all on function public._range_ok(date, date) from public, anon, authenticated;

create or replace function public.admin_set_plan(p_user uuid, p_active boolean, p_days integer default null, p_note text default null, p_tier text default 'pro', p_billing text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Only an admin can change plans'; end if;
  if p_active then
    if not exists (select 1 from public.plan_tiers where key = p_tier and rank > 0) then raise exception 'Unknown plan'; end if;
    insert into public.subscriptions (user_id, plan, billing, status, current_period_end, source, granted_by, note)
      values (p_user, p_tier, p_billing, 'active', case when p_days is null then null else now() + make_interval(days => p_days) end, 'admin', auth.uid(), left(p_note, 300))
    on conflict (user_id) do update set plan = excluded.plan, billing = excluded.billing, status = 'active', current_period_end = excluded.current_period_end,
      source = 'admin', granted_by = auth.uid(), note = excluded.note, updated_at = now();
    update public.plan_requests set status = 'handled' where user_id = p_user and status = 'open';
    perform public.notify(p_user, 'plan_activated', jsonb_build_object('plan', (select name from public.plan_tiers where key = p_tier)), '/business/plan');
  else
    update public.subscriptions set status = 'cancelled', updated_at = now() where user_id = p_user;
  end if;
  insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (auth.uid(), case when p_active then 'PLAN_GRANTED' else 'PLAN_REVOKED' end, 'subscriptions', p_user::text, jsonb_build_object('plan', p_tier, 'days', p_days));
end $$;

create or replace function public.request_plan(p_tier text, p_billing text default 'monthly', p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if not exists (select 1 from public.plan_tiers where key = p_tier and rank > 0) then raise exception 'Unknown plan'; end if;
  if p_billing not in ('monthly', 'yearly') then raise exception 'Unknown billing period'; end if;
  insert into public.plan_requests (user_id, plan, billing, note) values (auth.uid(), p_tier, p_billing, left(nullif(trim(p_note), ''), 500))
  on conflict (user_id) where status = 'open' do update set plan = excluded.plan, billing = excluded.billing, note = excluded.note, created_at = now();
end $$;

alter table public.subscriptions enable row level security;
alter table public.plan_requests enable row level security;
create policy subs_read on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy plan_req_read on public.plan_requests for select using (user_id = auth.uid() or public.is_admin());

-- ───────────────────────── CRM (seller) ─────────────────────────
create table public.crm_customers (
  store_id uuid not null references public.stores (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  notes text check (char_length(notes) <= 1000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  updated_at timestamptz not null default now(),
  primary key (store_id, buyer_id)
);
alter table public.crm_customers enable row level security;
create policy crm_owner_read on public.crm_customers for select
  using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));

-- Notes may only be kept on people who actually ordered from (or chatted with) the store.
create or replace function public.crm_save(p_store uuid, p_buyer uuid, p_notes text, p_tags text[])
returns void language plpgsql security definer set search_path = public as $$
declare clean text[];
begin
  if not exists (select 1 from public.stores where id = p_store and owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  if not exists (select 1 from public.orders where store_id = p_store and buyer_id = p_buyer)
     and not exists (select 1 from public.conversations where store_id = p_store and buyer_id = p_buyer) then
    raise exception 'This person is not one of your customers';
  end if;
  select coalesce(array_agg(distinct t), '{}') into clean
    from (select lower(left(trim(x), 24)) as t from unnest(coalesce(p_tags, '{}')) x) q where t <> '';
  if cardinality(clean) > 10 then raise exception 'Up to 10 tags'; end if;
  insert into public.crm_customers (store_id, buyer_id, notes, tags) values (p_store, p_buyer, left(nullif(trim(p_notes), ''), 1000), clean)
  on conflict (store_id, buyer_id) do update set notes = excluded.notes, tags = excluded.tags, updated_at = now();
end $$;

create or replace function public.crm_list(p_store uuid)
returns table (buyer_id uuid, display_name text, orders_count integer, completed_count integer, total_spent numeric,
               first_order_at timestamptz, last_order_at timestamptz, last_phone text, notes text, tags text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  return query
  select o.buyer_id, p.display_name,
         (count(*) filter (where o.status <> 'cancelled'))::int,
         (count(*) filter (where o.status = 'completed'))::int,
         coalesce(sum(o.amount) filter (where o.status = 'completed'), 0),
         min(o.created_at), max(o.created_at),
         (select d.phone from public.order_delivery d join public.orders x on x.id = d.order_id
           where x.store_id = p_store and x.buyer_id = o.buyer_id order by x.created_at desc limit 1),
         c.notes, coalesce(c.tags, '{}')
    from public.orders o
    join public.profiles p on p.id = o.buyer_id
    left join public.crm_customers c on c.store_id = p_store and c.buyer_id = o.buyer_id
   where o.store_id = p_store
   group by o.buyer_id, p.display_name, c.notes, c.tags
  having count(*) filter (where o.status <> 'cancelled') > 0
   order by max(o.created_at) desc;
end $$;

-- ───────────────────────── Supplier database (buyer) ─────────────────────────
create table public.supplier_notes (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  notes text check (char_length(notes) <= 1000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (buyer_id, store_id)
);
alter table public.supplier_notes enable row level security;
create policy supplier_notes_own on public.supplier_notes for all using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());

create or replace function public.supplier_list()
returns table (store_id uuid, store_name text, store_slug text, seller_type public.seller_type, verification_level smallint,
               orders_count integer, total_spent numeric, last_order_at timestamptz, last_order_id uuid,
               notes text, tags text[], favorite boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.slug, s.seller_type, s.verification_level,
         (count(*) filter (where o.status <> 'cancelled'))::int,
         coalesce(sum(o.amount) filter (where o.status = 'completed'), 0),
         max(o.created_at),
         (array_agg(o.id order by o.created_at desc) filter (where o.status = 'completed' and o.is_full_flow))[1],
         n.notes, coalesce(n.tags, '{}'), coalesce(n.favorite, false)
    from public.orders o
    join public.stores s on s.id = o.store_id
    left join public.supplier_notes n on n.store_id = s.id and n.buyer_id = auth.uid()
   where o.buyer_id = auth.uid()
   group by s.id, s.name, s.slug, s.seller_type, s.verification_level, n.notes, n.tags, n.favorite
  having count(*) filter (where o.status <> 'cancelled') > 0
   order by coalesce(n.favorite, false) desc, max(o.created_at) desc;
$$;

-- ───────────────────────── SMS (queued; provider not connected yet) ─────────────────────────
alter table public.profiles
  add column accepts_sms boolean not null default false,   -- buyers must opt IN to receive restock SMS
  add column sms_phone text;                               -- +639XXXXXXXXX

create table public.sms_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null check (phone ~ '^\+639\d{9}$'),
  enabled boolean not null default false,
  accepted_terms_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.sms_outbox (
  id bigint generated always as identity primary key,
  from_user uuid references public.profiles (id) on delete set null,
  to_user uuid references public.profiles (id) on delete set null,
  to_phone text not null,
  body text not null check (char_length(body) <= 320),
  kind text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index sms_outbox_status on public.sms_outbox (status, created_at);
alter table public.sms_settings enable row level security;
alter table public.sms_outbox enable row level security;
create policy sms_settings_own on public.sms_settings for select using (user_id = auth.uid());
create policy sms_outbox_own on public.sms_outbox for select using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());

create or replace function public.save_sms_settings(p_phone text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
declare ph text := public.normalize_ph_phone(p_phone);
begin
  perform public.assert_tier(4);
  if ph is null then raise exception 'Enter a valid Philippine mobile number'; end if;
  insert into public.sms_settings (user_id, phone, enabled, accepted_terms_at)
    values (auth.uid(), ph, p_enabled, case when p_enabled then now() end)
  on conflict (user_id) do update set phone = excluded.phone, enabled = excluded.enabled,
    accepted_terms_at = case when excluded.enabled then coalesce(public.sms_settings.accepted_terms_at, now()) else public.sms_settings.accepted_terms_at end,
    updated_at = now();
end $$;

-- ───────────────────────── Reminders ─────────────────────────
-- (a) your own restock reminders (free)  (b) follow-up rules that remind past customers (Pro)
create table public.restock_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  store_id uuid references public.stores (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  every_days integer not null check (every_days between 1 and 365),
  next_run_at timestamptz not null,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index restock_due on public.restock_reminders (next_run_at) where enabled;

create table public.follow_up_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  buyer_id uuid references public.profiles (id) on delete cascade,      -- one customer…
  listing_id uuid references public.listings (id) on delete cascade,    -- …or everyone who bought this product
  every_days integer not null check (every_days between 7 and 365),     -- min 7: no spamming
  message text check (char_length(message) <= 300),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (buyer_id is not null or listing_id is not null)
);
create table public.follow_up_log (
  id bigint generated always as identity primary key,
  rule_id uuid references public.follow_up_rules (id) on delete set null,
  store_id uuid not null references public.stores (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  sms boolean not null default false
);
create index follow_up_log_lookup on public.follow_up_log (store_id, buyer_id, sent_at desc);
create table public.reminder_optouts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

alter table public.restock_reminders enable row level security;
alter table public.follow_up_rules enable row level security;
alter table public.follow_up_log enable row level security;
alter table public.reminder_optouts enable row level security;
create policy restock_own on public.restock_reminders for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy follow_rules_read on public.follow_up_rules for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy follow_log_read on public.follow_up_log for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy optouts_own on public.reminder_optouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.restock_reminders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.restock_reminders where user_id = new.user_id) >= 30 then raise exception 'You can keep up to 30 reminders' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger restock_guard before insert on public.restock_reminders for each row execute function public.restock_reminders_guard();

-- Pro: create / change follow-up rules
create or replace function public.save_follow_up_rule(p_store uuid, p_every integer, p_message text default null, p_buyer uuid default null, p_listing uuid default null, p_enabled boolean default true, p_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  perform public.assert_tier(3);
  if not exists (select 1 from public.stores where id = p_store and owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  if p_buyer is null and p_listing is null then raise exception 'Choose a customer or a product'; end if;
  if p_every not between 7 and 365 then raise exception 'Reminders can repeat every 7 to 365 days'; end if;
  if p_buyer is not null and not exists (select 1 from public.orders where store_id = p_store and buyer_id = p_buyer) then raise exception 'This person is not one of your customers'; end if;
  if p_listing is not null and not exists (select 1 from public.listings where id = p_listing and store_id = p_store) then raise exception 'That product is not yours'; end if;
  if p_id is null and (select count(*) from public.follow_up_rules where store_id = p_store) >= 50 then raise exception 'Up to 50 follow-up rules' using errcode = 'P0001'; end if;
  if p_id is null then
    insert into public.follow_up_rules (store_id, buyer_id, listing_id, every_days, message, enabled)
      values (p_store, p_buyer, p_listing, p_every, left(nullif(trim(p_message), ''), 300), p_enabled) returning id into rid;
  else
    update public.follow_up_rules set every_days = p_every, message = left(nullif(trim(p_message), ''), 300), enabled = p_enabled
     where id = p_id and store_id = p_store returning id into rid;
    if rid is null then raise exception 'Rule not found'; end if;
  end if;
  return rid;
end $$;

create or replace function public.delete_follow_up_rule(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.follow_up_rules r using public.stores s where r.id = p_id and s.id = r.store_id and s.owner_id = auth.uid();
$$;

-- Runs from a daily cron (service role only). Sends in-app reminders; queues SMS only for opted-in people.
create or replace function public.run_due_reminders()
returns table (self_sent integer, follow_ups_sent integer, sms_queued integer)
language plpgsql security definer set search_path = public as $$
declare
  r record; c record; n_self int := 0; n_follow int := 0; n_sms int := 0;
  link text; phone text; sphone text; body text; buyer_phone text; accepts boolean;
begin
  -- (a) personal restock reminders
  for r in select * from public.restock_reminders where enabled and next_run_at <= now() loop
    link := coalesce(case when r.listing_id is not null then '/listing/' || r.listing_id
                          when r.store_id is not null then '/store/' || (select slug from public.stores where id = r.store_id) end, '/orders');
    perform public.notify(r.user_id, 'restock_self', jsonb_build_object('title', r.title), link);
    update public.restock_reminders set last_sent_at = now(), next_run_at = now() + make_interval(days => r.every_days) where id = r.id;
    n_self := n_self + 1;
    select st.phone into phone from public.sms_settings st where st.user_id = r.user_id and st.enabled;
    if phone is not null and public._tier_rank(r.user_id) >= 4 then
      insert into public.sms_outbox (from_user, to_user, to_phone, body, kind) values (null, r.user_id, phone, left('MarketplacePH reminder: ' || r.title || ' - time to restock. marketplaceph.com' || link, 320), 'restock_self');
      n_sms := n_sms + 1;
    end if;
  end loop;

  -- (b) seller follow-ups to past customers (Pro sellers only)
  for r in select fr.*, s.owner_id, s.name as store_name, s.slug as store_slug
             from public.follow_up_rules fr join public.stores s on s.id = fr.store_id where fr.enabled loop
    continue when public._tier_rank(r.owner_id) < 3;
    select st.phone into sphone from public.sms_settings st where st.user_id = r.owner_id and st.enabled and public._tier_rank(r.owner_id) >= 4;
    for c in
      select o.buyer_id as bid
        from public.orders o
       where o.store_id = r.store_id and o.status = 'completed'
         and (r.buyer_id is null or o.buyer_id = r.buyer_id)
         and (r.listing_id is null or exists (select 1 from public.order_items i where i.order_id = o.id and i.listing_id = r.listing_id))
       group by o.buyer_id
      having max(coalesce(o.confirmed_at, o.created_at)) <= now() - make_interval(days => r.every_days)
    loop
      continue when exists (select 1 from public.reminder_optouts x where x.user_id = c.bid and x.store_id = r.store_id);
      continue when exists (select 1 from public.orders o2 where o2.store_id = r.store_id and o2.buyer_id = c.bid
                              and o2.status in ('requested', 'quoted', 'payment_submitted', 'paid', 'packed', 'shipped', 'delivered'));
      continue when exists (select 1 from public.follow_up_log l where l.store_id = r.store_id and l.buyer_id = c.bid and l.sent_at > now() - interval '7 days');
      continue when exists (select 1 from public.follow_up_log l where l.rule_id = r.id and l.buyer_id = c.bid and l.sent_at > now() - make_interval(days => r.every_days));

      link := case when r.listing_id is not null then '/listing/' || r.listing_id else '/store/' || r.store_slug end;
      perform public.notify(c.bid, 'restock_follow_up', jsonb_build_object('store', r.store_name, 'slug', r.store_slug, 'message', r.message,
                            'store_id', r.store_id), link);
      select p.accepts_sms, coalesce(p.sms_phone, case when p.phone is not null then '+' || p.phone end) into accepts, buyer_phone from public.profiles p where p.id = c.bid;
      if coalesce(accepts, false) and buyer_phone is not null and sphone is not null then
        body := left(coalesce(r.message, r.store_name || ': time to restock?') || ' marketplaceph.com' || link || ' Opt out: marketplaceph.com/business/reminders', 320);
        insert into public.sms_outbox (from_user, to_user, to_phone, body, kind) values (r.owner_id, c.bid, buyer_phone, body, 'restock_follow_up');
        n_sms := n_sms + 1;
        insert into public.follow_up_log (rule_id, store_id, buyer_id, sms) values (r.id, r.store_id, c.bid, true);
      else
        insert into public.follow_up_log (rule_id, store_id, buyer_id, sms) values (r.id, r.store_id, c.bid, false);
      end if;
      n_follow := n_follow + 1;
    end loop;
  end loop;

  return query select n_self, n_follow, n_sms;
end $$;
revoke all on function public.run_due_reminders() from public, anon, authenticated;
grant execute on function public.run_due_reminders() to service_role;

-- ───────────────────────── Inventory ─────────────────────────
alter table public.listings add column low_stock_threshold integer check (low_stock_threshold >= 0);
alter table public.orders add column stock_applied boolean not null default false;

create table public.inventory_adjustments (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  delta integer not null,
  new_qty integer not null,
  reason text not null check (reason in ('order_paid', 'order_cancelled', 'manual', 'count')),
  order_id uuid references public.orders (id) on delete set null,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_adj_listing on public.inventory_adjustments (listing_id, created_at desc);
alter table public.inventory_adjustments enable row level security;
create policy inv_adj_read on public.inventory_adjustments for select using (
  exists (select 1 from public.listings l join public.stores s on s.id = l.store_id where l.id = listing_id and s.owner_id = auth.uid())
);

-- Stock is reduced when an order is PAID (or COD chosen) and put back if it is cancelled afterwards.
create or replace function public.orders_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare it record; l record; newq int; thr int;
begin
  if not new.is_full_flow then return new; end if;
  if new.status = 'paid' and old.status <> 'paid' and not new.stock_applied then
    for it in select listing_id, available_qty from public.order_items where order_id = new.id and available_qty > 0 and listing_id is not null loop
      select id, quantity_on_hand, low_stock_threshold, title into l from public.listings where id = it.listing_id for update;
      continue when l.quantity_on_hand is null;
      newq := greatest(l.quantity_on_hand - it.available_qty, 0);
      update public.listings set quantity_on_hand = newq where id = l.id;
      insert into public.inventory_adjustments (listing_id, delta, new_qty, reason, order_id) values (l.id, newq - l.quantity_on_hand, newq, 'order_paid', new.id);
      thr := coalesce(l.low_stock_threshold, 5);
      if l.quantity_on_hand > thr and newq <= thr then
        perform public.notify(new.seller_id, 'low_stock', jsonb_build_object('title', l.title, 'qty', newq), '/business/inventory');
      end if;
    end loop;
    new.stock_applied := true;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' and new.stock_applied then
    for it in select listing_id, available_qty from public.order_items where order_id = new.id and available_qty > 0 and listing_id is not null loop
      select id, quantity_on_hand into l from public.listings where id = it.listing_id for update;
      continue when l.quantity_on_hand is null;
      newq := l.quantity_on_hand + it.available_qty;
      update public.listings set quantity_on_hand = newq, stock_status = case when stock_status = 'out_of_stock' then 'in_stock' else stock_status end where id = l.id;
      insert into public.inventory_adjustments (listing_id, delta, new_qty, reason, order_id) values (l.id, it.available_qty, newq, 'order_cancelled', new.id);
    end loop;
    new.stock_applied := false;
  end if;
  return new;
end $$;
create trigger orders_stock_t before update on public.orders for each row execute function public.orders_stock();

create or replace function public.adjust_stock(p_listing uuid, p_new_qty integer, p_reason text default 'count') returns void
language plpgsql security definer set search_path = public as $$
declare l record;
begin
  select li.id, li.quantity_on_hand into l from public.listings li join public.stores s on s.id = li.store_id where li.id = p_listing and s.owner_id = auth.uid() for update of li;
  if not found then raise exception 'Listing not found'; end if;
  if p_new_qty is null or p_new_qty < 0 or p_new_qty > 10000000 then raise exception 'Enter a quantity of 0 or more'; end if;
  if p_reason not in ('manual', 'count') then raise exception 'Invalid reason'; end if;
  update public.listings set quantity_on_hand = p_new_qty,
         stock_status = case when p_new_qty > 0 and stock_status = 'out_of_stock' then 'in_stock' else stock_status end
   where id = p_listing;
  insert into public.inventory_adjustments (listing_id, delta, new_qty, reason, actor) values (p_listing, p_new_qty - coalesce(l.quantity_on_hand, 0), p_new_qty, p_reason, auth.uid());
end $$;

-- ───────────────────────── Reports ─────────────────────────
create or replace function public.seller_sales_summary(p_store uuid, p_from date, p_to date)
returns table (orders_count integer, revenue numeric, items_sold bigint, avg_order numeric, new_customers integer, repeat_customers integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  perform public._range_ok(p_from, p_to);
  return query
  with o as (select x.id, x.buyer_id, x.amount, x.quantity, coalesce(x.confirmed_at, x.created_at) as at
               from public.orders x where x.store_id = p_store and x.status = 'completed'),
  inr as (select * from o where o.at::date between p_from and p_to),
  firsts as (select o.buyer_id, min(o.at) as first_at from o group by o.buyer_id)
  select (select count(*) from inr)::int,
         coalesce((select sum(inr.amount) from inr), 0),
         coalesce((select sum(inr.quantity) from inr), 0)::bigint,
         coalesce((select round(avg(inr.amount), 2) from inr), 0),
         (select count(distinct inr.buyer_id) from inr join firsts f on f.buyer_id = inr.buyer_id where f.first_at::date between p_from and p_to)::int,
         (select count(distinct inr.buyer_id) from inr join firsts f on f.buyer_id = inr.buyer_id where f.first_at::date < p_from)::int;
end $$;

create or replace function public.seller_sales_series(p_store uuid, p_from date, p_to date, p_bucket text default 'day')
returns table (period date, orders_count integer, revenue numeric, qty bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  perform public.assert_tier(2);
  if p_bucket not in ('day', 'week', 'month') then raise exception 'Invalid bucket'; end if;
  if p_to < p_from or p_to - p_from > 800 then raise exception 'Invalid date range'; end if;
  return query
  select date_trunc(p_bucket, coalesce(o.confirmed_at, o.created_at))::date, count(*)::int, sum(o.amount), sum(o.quantity)::bigint
    from public.orders o
   where o.store_id = p_store and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to
   group by 1 order by 1;
end $$;

create or replace function public.seller_best_sellers(p_store uuid, p_from date, p_to date, p_limit integer default 10)
returns table (title text, qty bigint, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  perform public.assert_tier(2);
  return query
  select i.title, sum(i.available_qty)::bigint, coalesce(sum(i.available_qty * i.unit_price), 0)
    from public.order_items i join public.orders o on o.id = i.order_id
   where o.store_id = p_store and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to and i.available_qty > 0
   group by i.title order by 3 desc nulls last limit least(greatest(p_limit, 1), 50);
end $$;

create or replace function public.seller_top_customers(p_store uuid, p_from date, p_to date, p_limit integer default 10)
returns table (buyer_id uuid, display_name text, orders_count integer, spent numeric, qty bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then raise exception 'Not your store'; end if;
  perform public.assert_tier(2);
  return query
  select o.buyer_id, p.display_name, count(*)::int, sum(o.amount), sum(o.quantity)::bigint
    from public.orders o join public.profiles p on p.id = o.buyer_id
   where o.store_id = p_store and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to
   group by o.buyer_id, p.display_name order by 4 desc limit least(greatest(p_limit, 1), 50);
end $$;

create or replace function public.buyer_spend_summary(p_from date, p_to date)
returns table (total_spent numeric, orders_count integer, suppliers_count integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._range_ok(p_from, p_to);
  return query
  select coalesce(sum(o.amount), 0), count(*)::int, count(distinct o.store_id)::int
    from public.orders o where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to;
end $$;

create or replace function public.buyer_spend_by_supplier(p_from date, p_to date)
returns table (store_id uuid, store_name text, orders_count integer, spent numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_tier(2);
  return query
  select s.id, s.name, count(*)::int, sum(o.amount)
    from public.orders o join public.stores s on s.id = o.store_id
   where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to
   group by s.id, s.name order by 4 desc;
end $$;

create or replace function public.buyer_spend_by_category(p_from date, p_to date)
returns table (category text, spent numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_tier(2);
  return query
  with mine as (select o.id, o.amount, o.shipping_fee, o.is_full_flow from public.orders o
                 where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to)
  select coalesce(c.name_en, 'Uncategorized'), sum(i.available_qty * i.unit_price)
    from mine m join public.order_items i on i.order_id = m.id and i.available_qty > 0
    left join public.listings l on l.id = i.listing_id left join public.categories c on c.id = l.category_id
   group by 1
  union all select 'Shipping', sum(m.shipping_fee) from mine m where m.is_full_flow having sum(m.shipping_fee) > 0
  union all select 'Recorded deals (no item detail)', sum(m.amount) from mine m where not m.is_full_flow having sum(m.amount) > 0
  order by 2 desc;
end $$;

create or replace function public.buyer_spend_series(p_from date, p_to date, p_bucket text default 'month')
returns table (period date, spent numeric, orders_count integer)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_tier(2);
  if p_bucket not in ('day', 'week', 'month') then raise exception 'Invalid bucket'; end if;
  return query
  select date_trunc(p_bucket, coalesce(o.confirmed_at, o.created_at))::date, sum(o.amount), count(*)::int
    from public.orders o where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to
   group by 1 order by 1;
end $$;

-- ───────────────────────── Simple finance (not accounting software) ─────────────────────────
create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null check (char_length(category) between 2 and 40),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null check (char_length(category) between 2 and 40),
  vendor text check (char_length(vendor) <= 80),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index income_user_date on public.income_entries (user_id, entry_date desc);
create index expenses_user_date on public.expenses (user_id, entry_date desc);
alter table public.income_entries enable row level security;
alter table public.expenses enable row level security;
create policy income_own on public.income_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy expenses_own on public.expenses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.finance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.entry_date > current_date + 1 or new.entry_date < date '2000-01-01' then raise exception 'Check the date'; end if;
  return new;
end $$;
create trigger income_guard before insert or update on public.income_entries for each row execute function public.finance_guard();
create trigger expenses_guard before insert or update on public.expenses for each row execute function public.finance_guard();

create or replace function public.finance_summary(p_from date, p_to date)
returns table (order_income numeric, manual_income numeric, manual_expenses numeric, purchases numeric, net numeric)
language plpgsql stable security definer set search_path = public as $$
declare oi numeric; mi numeric; me numeric; pu numeric;
begin
  perform public._range_ok(p_from, p_to);
  select coalesce(sum(o.amount), 0) into oi from public.orders o where o.seller_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to;
  select coalesce(sum(e.amount), 0) into mi from public.income_entries e where e.user_id = auth.uid() and e.entry_date between p_from and p_to;
  select coalesce(sum(e.amount), 0) into me from public.expenses e where e.user_id = auth.uid() and e.entry_date between p_from and p_to;
  select coalesce(sum(o.amount), 0) into pu from public.orders o where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to;
  return query select oi, mi, me, pu, oi + mi - me - pu;
end $$;

create or replace function public.finance_pl(p_from date, p_to date)
returns table (section text, category text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_tier(4);
  if p_to < p_from then raise exception 'Invalid date range'; end if;
  return query
  select 'income', 'Sales through MarketplacePH', coalesce(sum(o.amount), 0) from public.orders o
   where o.seller_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to having coalesce(sum(o.amount), 0) > 0
  union all
  select 'income', e.category, sum(e.amount) from public.income_entries e where e.user_id = auth.uid() and e.entry_date between p_from and p_to group by e.category
  union all
  select 'expense', 'Purchases through MarketplacePH', coalesce(sum(o.amount), 0) from public.orders o
   where o.buyer_id = auth.uid() and o.status = 'completed' and coalesce(o.confirmed_at, o.created_at)::date between p_from and p_to having coalesce(sum(o.amount), 0) > 0
  union all
  select 'expense', e.category, sum(e.amount) from public.expenses e where e.user_id = auth.uid() and e.entry_date between p_from and p_to group by e.category
  order by 1, 3 desc;
end $$;

-- ───────────────────────── Lock down: authenticated only ─────────────────────────
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('my_tier', 'assert_tier', 'admin_set_plan', 'request_plan', 'crm_save', 'crm_list', 'supplier_list', 'save_sms_settings',
              'save_follow_up_rule', 'delete_follow_up_rule', 'adjust_stock', 'seller_sales_summary', 'seller_sales_series', 'seller_best_sellers', 'seller_top_customers',
              'buyer_spend_summary', 'buyer_spend_by_supplier', 'buyer_spend_by_category', 'buyer_spend_series', 'finance_summary', 'finance_pl')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

create trigger audit_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.log_admin_change();
