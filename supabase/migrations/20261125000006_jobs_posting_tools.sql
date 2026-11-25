-- Jobs posting tools (owner request, 25 Nov 2026): hiring tags, logo / creative image per post, saved jobs.
-- Additive only: three new nullable / defaulted columns on job_posts and one new table. Nothing existing is changed.
-- Rollback: supabase/rollback/20261125000006_jobs_posting_tools.down.sql

-- Hiring tags shown as badges. 'filled' (Hired / position filled) is set together with status 'closed'.
alter table public.job_posts
  add column if not exists hiring_tags text[] not null default '{}'
    check (hiring_tags <@ array['urgent', 'few_slots', 'wait_list', 'seasonal', 'filled']::text[]),
  -- Public images in the existing public 'store-assets' bucket ("<uploader id>/<uuid>.webp"); never the private job-documents bucket.
  add column if not exists logo_url text check (logo_url is null or logo_url ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  add column if not exists creative_url text check (creative_url is null or creative_url ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');

create index if not exists job_posts_urgent on public.job_posts (created_at desc) where status = 'active' and 'urgent' = any (hiring_tags);

-- Saved jobs (bookmarks) for job seekers: private to each member.
create table if not exists public.saved_jobs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.job_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.saved_jobs enable row level security;
create policy saved_jobs_read on public.saved_jobs for select using (user_id = auth.uid());
create policy saved_jobs_insert on public.saved_jobs for insert with check (
  user_id = auth.uid() and (select count(*) from public.saved_jobs s where s.user_id = auth.uid()) < 200);
create policy saved_jobs_delete on public.saved_jobs for delete using (user_id = auth.uid());
