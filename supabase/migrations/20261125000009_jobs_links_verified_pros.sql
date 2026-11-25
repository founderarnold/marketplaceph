-- Jobs: readable links, Commission-Based jobs and Verified Professional Accounts (owner request, 25 Nov 2026).
-- 1. Job type 'commission' (Commission-Based) next to Full-time, Part-time, Contract, Project-based, Internship, Freelance.
-- 2. Readable job links: every post gets a slug made from its title and city, e.g.
--    /jobs/marketing-manager-san-fernando-pampanga. Old /jobs/<uuid> links keep working (the page redirects).
--    When a title or city changes, the old slug is kept in old_slugs so links already shared still open the post.
-- 3. "Verified Professional Account" badge for job applicants: the applicant asks for it (badge_requests, the same
--    request table as the other badges) once their documents are complete; a full admin records the face-to-face
--    interview done by an appointed or accredited FLAME PH partner, then grants it. The badge is a user_badges row,
--    so it shows wherever badges already show (employers see it on every application). Revoking uses revoke_badge().
-- Additive: two constraints widened, two new columns, one new table (RLS on, admin-only), two read policies for
-- admins on applicants who asked for verification, functions re-created with the same behaviour plus the new cases.
-- Existing rows only get a slug filled in (other triggers are switched off for that one update so nothing else moves).
-- Rollback: supabase/rollback/20261125000009_jobs_links_verified_pros.down.sql

-- ───────── 1. Commission-Based ─────────
alter table public.job_posts drop constraint if exists job_posts_employment_type_check;
alter table public.job_posts add constraint job_posts_employment_type_check
  check (employment_type in ('full_time', 'part_time', 'contract', 'project', 'internship', 'freelance', 'commission'));

-- ───────── 2. Readable links ─────────
alter table public.job_posts
  add column if not exists slug text check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  add column if not exists old_slugs text[] not null default '{}' check (cardinality(old_slugs) <= 10);
create unique index if not exists job_posts_slug_key on public.job_posts (slug);
create index if not exists job_posts_old_slugs on public.job_posts using gin (old_slugs);

-- "Marketing Manager (Ñ)" -> "marketing-manager-n"
create or replace function public.job_slugify(p text) returns text
language sql immutable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(translate(coalesce(p, ''), 'ÑñÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÜü', 'NnAEIOUaeiouAEIOUaeiouUu')), '[^a-z0-9]+', '-', 'g'));
$$;

-- A free slug for a post: "<title>-<city>" (or "-remote", or "-<province>" when no city), with -2, -3 … if taken.
create or replace function public.job_post_slug(p_id uuid, p_title text, p_setup text, p_city text, p_province text) returns text
language plpgsql stable security definer set search_path = public as $$
declare place text; city text; prov text; base text; cand text; n int := 1;
begin
  if p_setup = 'remote' then place := 'remote';
  else
    select regexp_replace(c.name, '^\s*(city|municipality)\s+of\s+', '', 'i'), pr.name into city, prov
      from public.psgc_cities c left join public.psgc_provinces pr on pr.code = c.province_code
     where c.code = p_city;
    if city is null then
      select name into prov from public.psgc_provinces where code = p_province;
      place := prov;
    elsif prov is null or position(public.job_slugify(prov) in public.job_slugify(city)) > 0 then
      place := city;                       -- "Cebu City", not "Cebu City Cebu"
    else
      place := city || ' ' || prov;        -- "San Fernando Pampanga"
    end if;
  end if;
  base := left(public.job_slugify(p_title), 60);
  base := trim(both '-' from base);
  -- Add the place unless the title already says it ("... (Remote)" stays "...-remote", not "...-remote-remote").
  if place is not null and public.job_slugify(place) <> '' and position(public.job_slugify(place) in base) = 0 then
    base := base || '-' || left(public.job_slugify(place), 36);
  end if;
  base := trim(both '-' from base);
  if base = '' then base := 'job'; end if;
  cand := base;
  while exists (select 1 from public.job_posts where (slug = cand or cand = any (old_slugs)) and id is distinct from p_id) loop
    n := n + 1;
    cand := base || '-' || n;
  end loop;
  return cand;
end $$;

-- Nobody types a slug: it always follows the title / city. The previous one is remembered for old shared links.
create or replace function public.job_posts_set_slug() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  if tg_op = 'UPDATE' and old.slug is not null
     and (new.title, new.work_setup, new.city_code, new.province_code) is not distinct from (old.title, old.work_setup, old.city_code, old.province_code) then
    new.slug := old.slug;
    new.old_slugs := old.old_slugs;
    return new;
  end if;
  s := public.job_post_slug(new.id, new.title, new.work_setup, new.city_code, new.province_code);
  if tg_op = 'UPDATE' then
    new.old_slugs := old.old_slugs;
    if old.slug is not null and old.slug <> s then
      new.old_slugs := (array_append(array_remove(old.old_slugs, old.slug), old.slug))[greatest(1, cardinality(old.old_slugs) - 8):];
    end if;
    new.old_slugs := array_remove(new.old_slugs, s);
  else
    new.old_slugs := '{}';
  end if;
  new.slug := s;
  return new;
end $$;
drop trigger if exists job_posts_set_slug_t on public.job_posts;
create trigger job_posts_set_slug_t before insert or update on public.job_posts for each row execute function public.job_posts_set_slug();

-- Fill in slugs for posts that already exist, oldest first (the oldest keeps the plain slug). The other triggers are
-- off for this one statement so updated_at, the audit log and the post guards are not touched.
alter table public.job_posts disable trigger user;
do $$
declare r record;
begin
  for r in select id, title, work_setup, city_code, province_code from public.job_posts where slug is null order by created_at, id loop
    update public.job_posts set slug = public.job_post_slug(r.id, r.title, r.work_setup, r.city_code, r.province_code) where id = r.id;
  end loop;
end $$;
alter table public.job_posts enable trigger user;

-- ───────── 3. Verified Professional Account ─────────
alter table public.user_badges drop constraint if exists user_badges_badge_check;
alter table public.user_badges add constraint user_badges_badge_check
  check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified', 'verified_rider', 'verified_professional'));
alter table public.badge_requests drop constraint if exists badge_requests_badge_check;
alter table public.badge_requests add constraint badge_requests_badge_check
  check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified', 'verified_professional'));

-- Complete documents for verification: a finished job profile shared for applying, a resume, an ID photo and at least
-- one clearance. The same rule is in lib/jobs-verify.ts so the page shows exactly what is still missing.
create or replace function public.pro_docs_complete(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.job_profiles where user_id = p_user and consent_at is not null)
     and exists (select 1 from public.job_documents where user_id = p_user and kind = 'resume')
     and exists (select 1 from public.job_documents where user_id = p_user and kind in ('photo_2x2', 'photo_half_body'))
     and exists (select 1 from public.job_documents where user_id = p_user and kind in ('nbi_clearance', 'police_clearance', 'barangay_clearance'));
$$;
revoke execute on function public.pro_docs_complete(uuid) from public, anon, authenticated;

-- The face-to-face interview, recorded by a full admin. One per request.
create table if not exists public.pro_verification_interviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.badge_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  partner_name text not null check (char_length(partner_name) between 2 and 120),
  partner_kind text not null check (partner_kind in ('appointed', 'accredited')),
  partner_ref text check (char_length(partner_ref) <= 80),          -- FLAME PH partner ID / appointment number, if any
  interviewed_on date not null check (interviewed_on <= current_date and interviewed_on >= date '2026-01-01'),
  place text check (char_length(place) <= 160),
  result text not null check (result in ('passed', 'not_passed')),
  notes text check (char_length(notes) <= 1000),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index if not exists pro_verification_interviews_user on public.pro_verification_interviews (user_id);
alter table public.pro_verification_interviews enable row level security;
drop policy if exists pro_interviews_read on public.pro_verification_interviews;
create policy pro_interviews_read on public.pro_verification_interviews for select using (public.is_full_admin());
-- no insert/update/delete policies: written only by record_pro_interview().

-- Asking for the badge needs complete documents (checked again on approval).
create or replace function public.badge_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.user_badges where user_id = new.user_id and badge = new.badge) then
    raise exception 'You already have this badge';
  end if;
  if (select count(*) from public.badge_requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Daily request limit reached' using errcode = 'P0001';
  end if;
  if new.badge = 'verified_professional' and not public.pro_docs_complete(new.user_id) then
    raise exception 'Please complete your job profile and documents first' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.record_pro_interview(p_request uuid, p_partner_name text, p_partner_kind text, p_partner_ref text,
  p_date date, p_place text, p_result text, p_notes text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_full_admin() then raise exception 'Only an admin, founder or webmaster can record interviews'; end if;
  select * into r from public.badge_requests where id = p_request and badge = 'verified_professional';
  if not found or r.status <> 'pending' then raise exception 'Request not found or already decided'; end if;
  insert into public.pro_verification_interviews (request_id, user_id, partner_name, partner_kind, partner_ref, interviewed_on, place, result, notes, recorded_by)
  values (p_request, r.user_id, trim(p_partner_name), p_partner_kind, nullif(trim(p_partner_ref), ''), p_date, nullif(trim(p_place), ''), p_result,
          left(nullif(trim(p_notes), ''), 1000), auth.uid())
  on conflict (request_id) do update set partner_name = excluded.partner_name, partner_kind = excluded.partner_kind, partner_ref = excluded.partner_ref,
    interviewed_on = excluded.interviewed_on, place = excluded.place, result = excluded.result, notes = excluded.notes,
    recorded_by = excluded.recorded_by, recorded_at = now();
end $$;
revoke execute on function public.record_pro_interview(uuid, text, text, text, date, text, text, text) from public, anon;
grant execute on function public.record_pro_interview(uuid, text, text, text, date, text, text, text) to authenticated;

-- Same as before, plus: the Verified Professional badge needs a passed face-to-face interview and complete documents.
create or replace function public.review_badge_request(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_full_admin() then raise exception 'Only an admin, founder or webmaster can approve badges'; end if;
  select * into r from public.badge_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request not found or already decided'; end if;
  if p_approve and r.badge = 'verified_professional' then
    if not exists (select 1 from public.pro_verification_interviews where request_id = p_id and result = 'passed') then
      raise exception 'Record a passed face-to-face interview by a FLAME PH partner first' using errcode = 'P0001';
    end if;
    if not public.pro_docs_complete(r.user_id) then
      raise exception 'The applicant''s documents are no longer complete' using errcode = 'P0001';
    end if;
  end if;
  update public.badge_requests set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), reviewer_note = left(nullif(trim(p_note), ''), 500)
   where id = p_id;
  if p_approve then
    insert into public.user_badges (user_id, badge, granted_by) values (r.user_id, r.badge, auth.uid())
      on conflict (user_id, badge) do update set granted_by = excluded.granted_by, granted_at = now();
  end if;
  perform public.notify(r.user_id, case when p_approve then 'badge_approved' else 'badge_rejected' end,
                        jsonb_build_object('badge', r.badge, 'note', coalesce(p_note, '')), '/account/badges');
end $$;

-- Admins may read the profile and document list of an applicant who asked for verification (to check them).
create or replace function public.pro_request_open(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_full_admin() and exists (select 1 from public.badge_requests where user_id = p_user and badge = 'verified_professional' and status = 'pending');
$$;
drop policy if exists job_profiles_pro_admin_read on public.job_profiles;
create policy job_profiles_pro_admin_read on public.job_profiles for select using (public.pro_request_open(user_id));
drop policy if exists job_documents_pro_admin_read on public.job_documents;
create policy job_documents_pro_admin_read on public.job_documents for select using (public.pro_request_open(user_id));

-- Same as before, plus: a full admin may open the documents of an applicant with a pending verification request.
-- Every such open is logged in job_doc_access_logs, like an employer's.
create or replace function public.job_doc_open(p_doc uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from public.job_documents where id = p_doc;
  if not found then raise exception 'Document not found'; end if;
  if d.user_id <> auth.uid() then
    if not (public.employer_can_see_doc(p_doc) or public.pro_request_open(d.user_id)) then raise exception 'Document not found'; end if;
    insert into public.job_doc_access_logs (viewer_id, doc_id) values (auth.uid(), p_doc);
  end if;
  return d.storage_path;
end $$;
