-- "Bring my FLAME PH business": remembers which MarketplacePH store was filled from which flameph.org business listing,
-- and when the owner agreed. Additive only: one new table. Rollback: supabase/rollback/20261125000007_flame_business_links.down.sql

create table if not exists public.flame_business_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  flame_business_id uuid not null,                          -- id of the listing on flameph.org (another database)
  flame_slug text not null check (flame_slug ~ '^[a-z0-9][a-z0-9-]{1,100}$'),
  consent_at timestamptz not null,                          -- when the owner ticked "I agree" for this link
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, flame_business_id),
  unique (store_id)
);
alter table public.flame_business_links enable row level security;
create policy flame_business_links_read on public.flame_business_links for select using (user_id = auth.uid() or public.is_admin());
-- Only for yourself, and only for a store you own.
create policy flame_business_links_insert on public.flame_business_links for insert with check (
  user_id = auth.uid() and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy flame_business_links_update on public.flame_business_links for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy flame_business_links_delete on public.flame_business_links for delete using (user_id = auth.uid());
