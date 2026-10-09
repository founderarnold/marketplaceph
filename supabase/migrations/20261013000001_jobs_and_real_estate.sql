-- Jobs marketplace (job seekers ⇄ employers / manpower agencies) and the Real Estate category.
-- Privacy first: a seeker's profile and documents are visible ONLY to employers they apply to, and only the
-- documents the seeker chose to share with that application. Every document open is logged.

-- ───────────────────────── Real estate category ─────────────────────────
insert into public.categories (slug, name_en, name_fil, icon, sort_order)
values ('real-estate', 'Real Estate & Properties', 'Real Estate at Ari-arian', 'building-2', 13)
on conflict (slug) do nothing;

-- ───────────────────────── Job seeker profile ─────────────────────────
create table public.job_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  headline text check (char_length(headline) <= 100),
  phone text check (char_length(phone) between 7 and 20),
  contact_email text check (char_length(contact_email) <= 120),
  birthdate date check (birthdate is null or birthdate <= current_date - interval '15 years'),
  sex text check (sex in ('male', 'female', 'prefer_not')),
  civil_status text check (civil_status in ('single', 'married', 'widowed', 'separated')),
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  address_note text check (char_length(address_note) <= 200),
  about text check (char_length(about) <= 1500),
  education_level text check (education_level in ('elementary', 'high_school', 'senior_high', 'vocational', 'college_undergrad', 'college_grad', 'postgrad')),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  experience_years smallint check (experience_years between 0 and 60),
  desired_roles text check (char_length(desired_roles) <= 200),
  job_types text[] not null default '{}',
  expected_salary_min numeric(12, 2) check (expected_salary_min >= 0),
  expected_salary_max numeric(12, 2) check (expected_salary_max >= 0),
  work_history jsonb not null default '[]' check (jsonb_typeof(work_history) = 'array' and jsonb_array_length(work_history) <= 10),
  open_to_work boolean not null default true,
  -- the seeker agreed that employers they apply to can see this profile and the documents they pick
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger job_profiles_updated before update on public.job_profiles for each row execute function public.set_updated_at();

create table public.job_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('photo_2x2', 'photo_half_body', 'resume', 'barangay_clearance', 'police_clearance', 'nbi_clearance',
                                     'transcript', 'employment_certificate', 'diploma', 'license_certificate', 'other')),
  title text check (char_length(title) <= 80),
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer check (size_bytes between 1 and 6000000),
  created_at timestamptz not null default now()
);
create index job_documents_user on public.job_documents (user_id);

create or replace function public.job_documents_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.storage_path not like new.user_id::text || '/%' then raise exception 'Invalid file path'; end if;
  if (select count(*) from public.job_documents where user_id = new.user_id) >= 25 then
    raise exception 'You can keep up to 25 documents' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger job_documents_guard_t before insert on public.job_documents for each row execute function public.job_documents_guard();

-- ───────────────────────── Job posts (employers and manpower agencies) ─────────────────────────
create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  poster_type text not null default 'employer' check (poster_type in ('employer', 'agency')),
  company_name text not null check (char_length(company_name) between 2 and 100),
  agency_license_no text check (char_length(agency_license_no) <= 60),
  for_client boolean not null default false,             -- an agency hiring on behalf of a client
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('admin_office', 'sales_marketing', 'customer_service', 'food_hospitality', 'retail', 'logistics_driving',
                                             'construction_trades', 'manufacturing', 'agriculture', 'it_tech', 'education', 'healthcare',
                                             'security_cleaning', 'household_domestic', 'creative_media', 'finance_accounting', 'other')),
  description text not null check (char_length(description) between 20 and 5000),
  qualifications text check (char_length(qualifications) <= 3000),
  requirement_docs text[] not null default '{}',          -- document kinds the employer asks applicants to attach
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'contract', 'project', 'internship', 'freelance')),
  work_setup text not null default 'onsite' check (work_setup in ('onsite', 'remote', 'hybrid')),
  region_code text references public.psgc_regions (code),
  province_code text references public.psgc_provinces (code),
  city_code text references public.psgc_cities (code),
  salary_min numeric(12, 2) check (salary_min >= 0),
  salary_max numeric(12, 2) check (salary_max >= 0),
  salary_period text check (salary_period in ('hour', 'day', 'month', 'project')),
  vacancies integer not null default 1 check (vacancies between 1 and 1000),
  deadline date,
  status text not null default 'active' check (status in ('active', 'closed', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max is null or salary_min is null or salary_max >= salary_min)
);
create index job_posts_active on public.job_posts (created_at desc) where status = 'active';
create index job_posts_owner on public.job_posts (owner_id);
create index job_posts_title_trgm on public.job_posts using gin (title gin_trgm_ops);
create trigger job_posts_updated before update on public.job_posts for each row execute function public.set_updated_at();

-- Anti-scam guards: no up-front fees, agencies must show a licence number, and a cap on open posts.
create or replace function public.job_posts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare txt text := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || coalesce(new.qualifications, ''));
begin
  if tg_op = 'UPDATE' and new.status in ('closed', 'hidden', 'removed') and (new.title, new.description, new.qualifications) is not distinct from (old.title, old.description, old.qualifications) then
    return new;   -- closing / hiding an old post must always be possible
  end if;
  if txt ~ '(placement|processing|training|registration|medical|application|deployment)\s+fee' or txt ~ '(pay|deposit|send)\s+(first|upfront|up-front|before)' or txt ~ 'bayad\s+(muna|una)' then
    raise exception 'Job posts cannot ask applicants to pay any fee. Legitimate employers never charge for jobs.' using errcode = 'P0001';
  end if;
  if new.poster_type = 'agency' and char_length(trim(coalesce(new.agency_license_no, ''))) < 3 then
    raise exception 'Manpower agencies must enter their licence or registration number' using errcode = 'P0001';
  end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active')
     and (select count(*) from public.job_posts where owner_id = new.owner_id and status = 'active' and id <> new.id) >= 25 then
    raise exception 'You can have up to 25 open job posts at a time' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger job_posts_guard_t before insert or update on public.job_posts for each row execute function public.job_posts_guard();

-- ───────────────────────── Applications ─────────────────────────
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.job_posts (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 1000),
  shared_doc_ids uuid[] not null default '{}' check (cardinality(shared_doc_ids) <= 25),
  status text not null default 'submitted' check (status in ('submitted', 'viewed', 'shortlisted', 'interview', 'rejected', 'hired', 'withdrawn')),
  employer_note text check (char_length(employer_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, applicant_id)
);
create index job_applications_applicant on public.job_applications (applicant_id, created_at desc);
create index job_applications_post on public.job_applications (post_id, created_at desc);
create trigger job_applications_updated before update on public.job_applications for each row execute function public.set_updated_at();

create table public.job_doc_access_logs (
  id bigint generated always as identity primary key,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  doc_id uuid not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Visibility helpers ─────────────────────────
-- Is the current user an employer that this person applied to?
create or replace function public.employer_can_see_applicant(p_applicant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_applications a join public.job_posts p on p.id = a.post_id
                  where a.applicant_id = p_applicant and p.owner_id = auth.uid() and a.status <> 'withdrawn');
$$;
create or replace function public.employer_can_see_doc(p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_applications a join public.job_posts p on p.id = a.post_id
                  where p.owner_id = auth.uid() and a.status <> 'withdrawn' and p_doc = any (a.shared_doc_ids));
$$;

-- ───────────────────────── RLS ─────────────────────────
alter table public.job_profiles enable row level security;
alter table public.job_documents enable row level security;
alter table public.job_posts enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_doc_access_logs enable row level security;

create policy job_profiles_read on public.job_profiles for select using (user_id = auth.uid() or public.employer_can_see_applicant(user_id));
create policy job_profiles_insert on public.job_profiles for insert with check (user_id = auth.uid());
create policy job_profiles_update on public.job_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy job_profiles_delete on public.job_profiles for delete using (user_id = auth.uid());

create policy job_documents_read on public.job_documents for select using (user_id = auth.uid() or public.employer_can_see_doc(id));
create policy job_documents_insert on public.job_documents for insert with check (user_id = auth.uid());
create policy job_documents_delete on public.job_documents for delete using (user_id = auth.uid());

create policy job_posts_read on public.job_posts for select
  using ((status = 'active' and (deadline is null or deadline >= current_date)) or owner_id = auth.uid() or public.is_admin());
create policy job_posts_insert on public.job_posts for insert with check (owner_id = auth.uid());
create policy job_posts_update on public.job_posts for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy job_posts_delete on public.job_posts for delete using (owner_id = auth.uid());

create policy job_applications_read on public.job_applications for select
  using (applicant_id = auth.uid() or exists (select 1 from public.job_posts p where p.id = post_id and p.owner_id = auth.uid()));
-- no insert/update policies: applications are created and changed only by the functions below.

create policy job_doc_logs_read on public.job_doc_access_logs for select using (public.is_admin());

-- Moderators may remove a post but may not rewrite who owns it.
create or replace function public.job_posts_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'Cannot change the owner of a post'; end if;
  if auth.uid() is not null and auth.uid() <> old.owner_id and public.is_admin() then
    if (new.title, new.description, new.qualifications, new.company_name) is distinct from (old.title, old.description, old.qualifications, old.company_name) then
      raise exception 'Moderators can only change the status of a post';
    end if;
  end if;
  return new;
end $$;
create trigger job_posts_protect_t before update on public.job_posts for each row execute function public.job_posts_protect();

-- ───────────────────────── Workflow functions ─────────────────────────
create or replace function public.apply_to_job(p_post uuid, p_note text default null, p_docs uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p record; prof record; aid uuid; bad int;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  perform public.assert_not_restricted(uid);
  select * into p from public.job_posts where id = p_post and status = 'active' and (deadline is null or deadline >= current_date);
  if not found then raise exception 'This job is no longer open'; end if;
  if p.owner_id = uid then raise exception 'You cannot apply to your own job post'; end if;
  select * into prof from public.job_profiles where user_id = uid;
  if not found or prof.consent_at is null then raise exception 'Please complete your job profile and agree to share it before applying'; end if;
  if exists (select 1 from public.job_applications where post_id = p_post and applicant_id = uid) then raise exception 'You already applied to this job'; end if;
  if (select count(*) from public.job_applications where applicant_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily application limit reached' using errcode = 'P0001';
  end if;
  select count(*) into bad from unnest(coalesce(p_docs, '{}')) d where not exists (select 1 from public.job_documents j where j.id = d and j.user_id = uid);
  if bad > 0 then raise exception 'One of the selected documents was not found'; end if;
  insert into public.job_applications (post_id, applicant_id, note, shared_doc_ids)
    values (p_post, uid, left(nullif(trim(p_note), ''), 1000), coalesce(p_docs, '{}')) returning id into aid;
  perform public.notify(p.owner_id, 'job_application_received', jsonb_build_object('title', left(p.title, 60), 'name', prof.full_name), '/jobs/employer/' || p.id);
  return aid;
end $$;

create or replace function public.set_application_status(p_app uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a record; p record;
begin
  if p_status not in ('viewed', 'shortlisted', 'interview', 'rejected', 'hired') then raise exception 'Invalid status'; end if;
  select * into a from public.job_applications where id = p_app;
  if not found then raise exception 'Application not found'; end if;
  select * into p from public.job_posts where id = a.post_id and owner_id = auth.uid();
  if not found then raise exception 'Application not found'; end if;
  if a.status = 'withdrawn' then raise exception 'The applicant withdrew this application'; end if;
  update public.job_applications set status = p_status, employer_note = left(nullif(trim(p_note), ''), 500) where id = p_app;
  if p_status <> 'viewed' and a.status is distinct from p_status then
    perform public.notify(a.applicant_id, 'job_application_status', jsonb_build_object('title', left(p.title, 60), 'status', p_status), '/jobs/applications');
  end if;
end $$;

create or replace function public.withdraw_application(p_app uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.job_applications set status = 'withdrawn' where id = p_app and applicant_id = auth.uid() and status not in ('hired', 'withdrawn');
  if not found then raise exception 'Application not found'; end if;
end $$;

-- Returns the storage path of a document the caller may open (their own, or one shared with an application to their job
-- post) and logs the access. The server then signs a short-lived URL.
create or replace function public.job_doc_open(p_doc uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from public.job_documents where id = p_doc;
  if not found then raise exception 'Document not found'; end if;
  if d.user_id <> auth.uid() then
    if not public.employer_can_see_doc(p_doc) then raise exception 'Document not found'; end if;
    insert into public.job_doc_access_logs (viewer_id, doc_id) values (auth.uid(), p_doc);
  end if;
  return d.storage_path;
end $$;

-- ───────────────────────── Storage (private) ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-documents', 'job-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "own read job documents" on storage.objects for select to authenticated
  using (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own upload job documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own delete job documents" on storage.objects for delete to authenticated
  using (bucket_id = 'job-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── Grants ─────────────────────────
do $$
declare f text;
begin
  foreach f in array array['apply_to_job(uuid, text, uuid[])', 'set_application_status(uuid, text, text)', 'withdraw_application(uuid)', 'job_doc_open(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['employer_can_see_applicant(uuid)', 'employer_can_see_doc(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
