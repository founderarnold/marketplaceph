-- Jobs 2.0 P6 (flag jobs2_employer_pipeline): an append-only record of employer verification reviews.
-- Additive only: one new table. The Credible Employer badge itself is still granted through the existing
-- badge_requests / review_badge_request() flow; this table records what the reviewer checked and decided.
-- Rollback: supabase/rollback/20261125000003_jobs2_employer_reviews.down.sql

create table public.employer_reviews (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id),
  documents_checked text[] not null default '{}' check (documents_checked <@ array['dti_bn', 'sec_registration', 'cda_registration', 'mayors_permit', 'bir_cor', 'dole_agency_license', 'valid_id_owner', 'business_address_proof', 'other']::text[]),
  official_source_checked boolean not null default false,   -- e.g. looked up the DTI BNRS, SEC or DOLE list directly
  official_source text check (char_length(official_source) <= 120),
  is_agency boolean not null default false,
  agency_license_checked boolean not null default false,
  decision text not null check (decision in ('approved', 'needs_more', 'rejected')),
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  check (not is_agency or decision <> 'approved' or agency_license_checked)    -- agencies need a checked licence to be approved
);
create index employer_reviews_employer on public.employer_reviews (employer_id, created_at desc);
alter table public.employer_reviews enable row level security;
-- Only full admins (admin, founder, webmaster) can read or add reviews. No update or delete: the record is append-only.
create policy employer_reviews_read on public.employer_reviews for select using (public.is_full_admin());
create policy employer_reviews_insert on public.employer_reviews for insert with check (public.is_full_admin() and reviewer_id = auth.uid());
