-- Rollback for 20261125000009_jobs_links_verified_pros.sql.
-- WARNING: Commission-Based posts become Freelance (needed to restore the old type list); readable job links stop
-- working (old /jobs/<uuid> links keep working); Verified Professional badges, their requests and the recorded
-- interviews are removed.
update public.job_posts set employment_type = 'freelance' where employment_type = 'commission';
alter table public.job_posts drop constraint if exists job_posts_employment_type_check;
alter table public.job_posts add constraint job_posts_employment_type_check
  check (employment_type in ('full_time', 'part_time', 'contract', 'project', 'internship', 'freelance'));

drop trigger if exists job_posts_set_slug_t on public.job_posts;
drop function if exists public.job_posts_set_slug();
drop function if exists public.job_post_slug(uuid, text, text, text, text);
drop function if exists public.job_slugify(text);
drop index if exists public.job_posts_old_slugs;
drop index if exists public.job_posts_slug_key;
alter table public.job_posts drop column if exists old_slugs, drop column if exists slug;

drop policy if exists job_profiles_pro_admin_read on public.job_profiles;
drop policy if exists job_documents_pro_admin_read on public.job_documents;
drop function if exists public.record_pro_interview(uuid, text, text, text, date, text, text, text);
drop table if exists public.pro_verification_interviews;
delete from public.user_badges where badge = 'verified_professional';
delete from public.badge_requests where badge = 'verified_professional';
alter table public.user_badges drop constraint if exists user_badges_badge_check;
alter table public.user_badges add constraint user_badges_badge_check
  check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified', 'verified_rider'));
alter table public.badge_requests drop constraint if exists badge_requests_badge_check;
alter table public.badge_requests add constraint badge_requests_badge_check
  check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified'));

-- Restore the earlier functions (20261018000002_social_reviews_badges.sql, 20261013000001_jobs_and_real_estate.sql).
create or replace function public.badge_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.user_badges where user_id = new.user_id and badge = new.badge) then
    raise exception 'You already have this badge';
  end if;
  if (select count(*) from public.badge_requests where user_id = new.user_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Daily request limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.review_badge_request(p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_full_admin() then raise exception 'Only an admin, founder or webmaster can approve badges'; end if;
  select * into r from public.badge_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Request not found or already decided'; end if;
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
drop function if exists public.pro_request_open(uuid);
drop function if exists public.pro_docs_complete(uuid);
