-- Jobs 2.0 P2 (flag jobs2_landing): privacy-safe funnel events and saved job searches ("notify me").
-- Additive only: two new tables and one function. Nothing existing is changed.
-- Rollback: supabase/rollback/20261125000002_jobs2_landing_events.down.sql

-- ───────── Funnel events: no names, emails, phones, search text or Facebook ids; only allow-listed fields ─────────
create table public.job_funnel_events (
  id bigint generated always as identity primary key,
  name text not null check (name in ('jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'referral_attribution')),
  session_id text not null check (session_id ~ '^[A-Za-z0-9_-]{16,64}$'),   -- random per-browser id, not linked to a person
  user_id uuid references public.profiles (id) on delete set null,          -- only when signed in
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1024),
  attribution jsonb not null default '{}' check (jsonb_typeof(attribution) = 'object' and pg_column_size(attribution) <= 512),
  created_at timestamptz not null default now()
);
create index job_funnel_events_name_time on public.job_funnel_events (name, created_at desc);
alter table public.job_funnel_events enable row level security;
create policy job_funnel_events_read on public.job_funnel_events for select using (public.is_full_admin());
-- no insert/update/delete policies: rows are written only by record_job_event() below.

create or replace function public.record_job_event(p_name text, p_session text, p_props jsonb default '{}', p_attr jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  props jsonb := '{}';
  attr jsonb := '{}';
  k text;
  v text;
begin
  if p_name not in ('jobs_landing_view', 'job_search', 'job_view', 'signup_start', 'referral_attribution') then return; end if;
  if p_session is null or p_session !~ '^[A-Za-z0-9_-]{16,64}$' then return; end if;
  -- keep only allow-listed, short, safe values
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_props, '{}')) loop
    if k in ('has_q', 'has_loc') and v in ('true', 'false') then props := props || jsonb_build_object(k, v::boolean);
    elsif k = 'results' and v in ('0', '1-5', '6-20', '21+') then props := props || jsonb_build_object(k, v);
    elsif k in ('category', 'source') and v ~ '^[a-z_]{1,30}$' then props := props || jsonb_build_object(k, v);
    elsif k = 'job_id' and v ~ '^[0-9a-f-]{36}$' then props := props || jsonb_build_object(k, v);
    end if;
  end loop;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_attr, '{}')) loop
    if k in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'ch') and v ~ '^[a-z0-9][a-z0-9_.-]{0,39}$' and v !~ '[0-9]{7,}' then
      attr := attr || jsonb_build_object(k, v);
    end if;
  end loop;
  -- simple flood guard: at most 300 events per browser per day
  if (select count(*) from public.job_funnel_events where session_id = p_session and created_at > now() - interval '1 day') >= 300 then return; end if;
  insert into public.job_funnel_events (name, session_id, user_id, props, attribution) values (p_name, p_session, auth.uid(), props, attr);
end $$;
revoke all on function public.record_job_event(text, text, jsonb, jsonb) from public;
grant execute on function public.record_job_event(text, text, jsonb, jsonb) to anon, authenticated;

-- ───────── Saved job searches ("notify me" when nothing matches). Signed-in members only; own rows only. ─────────
create table public.job_search_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  q text check (char_length(q) <= 80),
  location text check (char_length(location) <= 60),
  category text check (char_length(category) <= 30),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, q, location, category)
);
alter table public.job_search_alerts enable row level security;
create policy job_search_alerts_read on public.job_search_alerts for select using (user_id = auth.uid() or public.is_full_admin());
create policy job_search_alerts_insert on public.job_search_alerts for insert with check (
  user_id = auth.uid() and (select count(*) from public.job_search_alerts a where a.user_id = auth.uid()) < 10);
create policy job_search_alerts_delete on public.job_search_alerts for delete using (user_id = auth.uid());
