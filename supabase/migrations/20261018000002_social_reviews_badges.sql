-- Social layer: suki friends (one-tap follow), public updates and a friends feed, public Q&A comments on items,
-- reviews after a hiring, admin-approved badges, and featured users for the home page.
-- Founder and webmaster get the same powers as admin everywhere.

/* ───────── Staff roles: founder + webmaster = admin ───────── */

-- Full admins (may change roles, plans, disputes, appeals, badges, featured pins). Moderators stay a lighter role.
create or replace function public.is_full_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder', 'webmaster'));
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'moderator', 'founder', 'webmaster'));
$$;

-- Existing functions that check role = 'admin' literally: widen them to founder + webmaster (definition rewritten in place).
do $$
declare f record; d text;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
             and p.proname in ('admin_set_plan', 'decide_appeal', 'decide_case', 'protect_profile_role', 'resolve_dispute') loop
    d := pg_get_functiondef(f.oid);
    d := replace(d, 'role = ''admin''', 'role in (''admin'', ''founder'', ''webmaster'')');
    d := replace(d, 'role not in (''admin'', ''moderator'')', 'role not in (''admin'', ''moderator'', ''founder'', ''webmaster'')');
    execute d;
  end loop;
end $$;

/* ───────── Shared guard helpers ───────── */

-- Same banned-keyword list as listings.
create or replace function public.assert_clean_text(p_text text) returns void
language plpgsql stable security definer set search_path = public as $$
declare hit record;
begin
  select keyword, reason into hit from public.banned_keywords where lower(coalesce(p_text, '')) like '%' || lower(keyword) || '%' limit 1;
  if found then raise exception 'This can''t be posted (%): %', hit.keyword, hit.reason using errcode = 'P0001'; end if;
end $$;

create or replace function public.display_name_of(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(display_name, ''), 'A MarketplacePH member') from public.profiles where id = p_user;
$$;

/* ───────── Suki friends (one tap, no approval) ───────── */

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id, created_at desc);
alter table public.follows enable row level security;
-- Who-added-whom is private to the two people; totals are public through friend_counts().
create policy follows_read on public.follows for select using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert on public.follows for insert with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete using (follower_id = auth.uid());

create or replace function public.follows_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.follows where follower_id = new.follower_id and created_at > now() - interval '1 day') >= 300 then
    raise exception 'Daily friend limit reached' using errcode = 'P0001';
  end if;
  perform public.notify(new.followee_id, 'new_friend', jsonb_build_object('name', public.display_name_of(new.follower_id)), '/updates?tab=followers');
  return new;
end $$;
create trigger follows_guard before insert on public.follows for each row execute function public.follows_guard();

-- friends = people who added this user; following = people this user added; suki = both ways.
create or replace function public.friend_counts(p_user uuid)
returns table (friends integer, following integer, suki integer)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.follows where followee_id = p_user)::int,
         (select count(*) from public.follows where follower_id = p_user)::int,
         (select count(*) from public.follows a join public.follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
           where a.follower_id = p_user)::int;
$$;

/* ───────── Public updates ───────── */

create table public.user_updates (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000),
  listing_id uuid references public.listings (id) on delete set null,
  job_id uuid references public.job_posts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_updates_author on public.user_updates (author_id, created_at desc);
alter table public.user_updates enable row level security;
create policy user_updates_read on public.user_updates for select using (true);
create policy user_updates_insert on public.user_updates for insert with check (author_id = auth.uid());
create policy user_updates_delete on public.user_updates for delete using (author_id = auth.uid() or public.is_admin());

create or replace function public.user_updates_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_not_restricted(new.author_id);
  perform public.assert_clean_text(new.body);
  if (select count(*) from public.user_updates where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily update limit reached (10)' using errcode = 'P0001';
  end if;
  if new.listing_id is not null and not exists (
    select 1 from public.listings l join public.stores s on s.id = l.store_id where l.id = new.listing_id and s.owner_id = new.author_id) then
    raise exception 'You can only link your own listing';
  end if;
  if new.job_id is not null and not exists (select 1 from public.job_posts j where j.id = new.job_id and j.owner_id = new.author_id) then
    raise exception 'You can only link your own job post';
  end if;
  return new;
end $$;
create trigger user_updates_guard before insert on public.user_updates for each row execute function public.user_updates_guard();

/* ───────── Friends feed: updates, new items and new jobs from the people I added ───────── */

create or replace function public.friends_feed(p_before timestamptz default null, p_limit integer default 30)
returns table (kind text, item_id uuid, actor_id uuid, actor_name text, title text, body text, image_path text,
               price_type text, price_min numeric, price_max numeric, unit text, link_slug text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  friends as (select f.followee_id as id from public.follows f, me where f.follower_id = me.id),
  cutoff as (select coalesce(p_before, now()) as t)
  select * from (
    select 'update'::text, u.id, u.author_id, public.display_name_of(u.author_id), null::text, u.body, null::text,
           null::text, null::numeric, null::numeric, null::text,
           coalesce(u.listing_id::text, u.job_id::text), u.created_at
      from public.user_updates u, cutoff where u.author_id in (select id from friends) and u.created_at < cutoff.t
    union all
    select 'listing', l.id, s.owner_id, s.name, l.title, null,
           (select i.path from public.listing_images i where i.listing_id = l.id order by i.position limit 1),
           l.price_type::text, l.price_min, l.price_max, l.unit, s.slug, l.created_at
      from public.listings l join public.stores s on s.id = l.store_id, cutoff
     where s.owner_id in (select id from friends) and l.status = 'active' and l.created_at < cutoff.t and l.created_at > now() - interval '90 days'
    union all
    select 'job', j.id, j.owner_id, coalesce(j.company_name, public.display_name_of(j.owner_id)), j.title, null, null,
           null, j.salary_min, j.salary_max, null, null, j.created_at
      from public.job_posts j, cutoff
     where j.owner_id in (select id from friends) and j.status = 'active' and j.created_at < cutoff.t and j.created_at > now() - interval '90 days'
  ) x
  order by 13 desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;
revoke all on function public.friends_feed(timestamptz, integer) from public, anon;
grant execute on function public.friends_feed(timestamptz, integer) to authenticated;

/* ───────── Public Q&A comments on listings and job posts ───────── */

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('listing', 'job')),
  target_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 1000),
  created_at timestamptz not null default now()
);
create index comments_target on public.comments (target_kind, target_id, created_at);
alter table public.comments enable row level security;

create or replace function public.comment_target_owner(p_kind text, p_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case p_kind
    when 'listing' then (select s.owner_id from public.listings l join public.stores s on s.id = l.store_id where l.id = p_id and l.status = 'active')
    when 'job' then (select j.owner_id from public.job_posts j where j.id = p_id and j.status = 'active')
  end;
$$;

create policy comments_read on public.comments for select using (true);
create policy comments_insert on public.comments for insert with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete using (
  author_id = auth.uid() or public.comment_target_owner(target_kind, target_id) = auth.uid() or public.is_admin()
);

create or replace function public.comments_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  perform public.assert_not_restricted(new.author_id);
  perform public.assert_clean_text(new.body);
  owner := public.comment_target_owner(new.target_kind, new.target_id);
  if owner is null then raise exception 'This post is not available'; end if;
  if (select count(*) from public.comments where author_id = new.author_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily comment limit reached' using errcode = 'P0001';
  end if;
  if owner <> new.author_id then
    perform public.notify(owner, 'new_comment', jsonb_build_object('name', public.display_name_of(new.author_id)),
      case new.target_kind when 'listing' then '/listing/' else '/jobs/' end || new.target_id || '#comments');
  end if;
  return new;
end $$;
create trigger comments_guard before insert on public.comments for each row execute function public.comments_guard();

/* ───────── Reviews after a hiring (employer ⇄ applicant) ───────── */

create table public.job_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid references public.profiles (id) on delete cascade,
  direction text check (direction in ('applicant_to_employer', 'employer_to_applicant')),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (application_id, reviewer_id)
);
create index job_reviews_reviewee on public.job_reviews (reviewee_id, direction, created_at desc);
alter table public.job_reviews enable row level security;
create policy job_reviews_read on public.job_reviews for select using (true);
create policy job_reviews_insert on public.job_reviews for insert with check (reviewer_id = auth.uid());

create or replace function public.job_reviews_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; employer uuid;
begin
  select ja.*, jp.owner_id as post_owner into a from public.job_applications ja join public.job_posts jp on jp.id = ja.post_id where ja.id = new.application_id;
  if not found or a.status <> 'hired' then raise exception 'You can only review after a hiring'; end if;
  employer := a.post_owner;
  if new.reviewer_id = a.applicant_id then new.direction := 'applicant_to_employer'; new.reviewee_id := employer;
  elsif new.reviewer_id = employer then new.direction := 'employer_to_applicant'; new.reviewee_id := a.applicant_id;
  else raise exception 'You were not part of this hiring'; end if;
  if new.comment is not null then perform public.assert_clean_text(new.comment); end if;
  perform public.notify(new.reviewee_id, 'new_review', jsonb_build_object('name', public.display_name_of(new.reviewer_id), 'rating', new.rating), '/updates');
  return new;
end $$;
create trigger job_reviews_guard before insert on public.job_reviews for each row execute function public.job_reviews_guard();

-- Average rating for a person as employer or as applicant.
create or replace function public.job_rating(p_user uuid, p_direction text)
returns table (avg_rating numeric, review_count integer)
language sql stable security definer set search_path = public as $$
  select round(avg(rating)::numeric, 1), count(*)::int from public.job_reviews where reviewee_id = p_user and direction = p_direction;
$$;

-- Reviews of one listing: buyer reviews of completed orders that included it.
create or replace function public.listing_reviews(p_listing uuid, p_limit integer default 20)
returns table (rating smallint, comment text, reviewer_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.rating, r.comment, public.display_name_of(r.reviewer_id), r.created_at
    from public.reviews r
   where r.direction = 'buyer_to_seller' and exists (select 1 from public.order_items oi where oi.order_id = r.order_id and oi.listing_id = p_listing)
   order by r.created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

/* ───────── Badges approved by admin / founder / webmaster ───────── */

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
create policy user_badges_read on public.user_badges for select using (true); -- written only through review_badge_request()

create table public.badge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  badge text not null check (badge in ('verified_buyer', 'good_applicant', 'credible_employer', 'years_verified')),
  note text check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text check (char_length(reviewer_note) <= 500),
  created_at timestamptz not null default now()
);
create unique index badge_requests_one_pending on public.badge_requests (user_id, badge) where status = 'pending';
create index badge_requests_status on public.badge_requests (status, created_at);
alter table public.badge_requests enable row level security;
create policy badge_requests_read on public.badge_requests for select using (user_id = auth.uid() or public.is_full_admin());
create policy badge_requests_insert on public.badge_requests for insert with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null);

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
create trigger badge_requests_guard before insert on public.badge_requests for each row execute function public.badge_requests_guard();

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

create or replace function public.revoke_badge(p_user uuid, p_badge text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_full_admin() then raise exception 'Only an admin, founder or webmaster can remove badges'; end if;
  delete from public.user_badges where user_id = p_user and badge = p_badge;
end $$;

/* ───────── Featured users (home page) ───────── */

create table public.featured_pins (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('seller', 'buyer', 'applicant', 'employer')),
  pinned_by uuid references public.profiles (id) on delete set null,
  until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.featured_pins enable row level security;
create policy featured_pins_read on public.featured_pins for select using (true);
create policy featured_pins_write on public.featured_pins for all using (public.is_full_admin()) with check (public.is_full_admin());

-- Ranked by ratings, reviews, badges, suki friends and activity, with a small daily shuffle so everyone good gets a turn.
-- Admin pins always come first. Only people who chose to be public appear (buyers: public buyer sheet; applicants: open to work).
create or replace function public.featured_users(p_kind text, p_limit integer default 8)
returns table (user_id uuid, name text, subtitle text, image text, link text, avg_rating numeric, review_count integer,
               friends integer, badges text[], verification_level integer, pinned boolean)
language sql stable security definer set search_path = public as $$
  with pins as (select fp.user_id from public.featured_pins fp where fp.kind = p_kind and (fp.until is null or fp.until > now())),
  fol as (select followee_id as id, count(*)::int as n from public.follows group by followee_id),
  bad as (select ub.user_id as id, array_agg(ub.badge order by ub.badge) as b from public.user_badges ub group by ub.user_id),
  cand as (
    -- sellers: stores with something on sale
    select s.owner_id as uid, s.name, s.tagline as sub, s.logo_url as img, '/store/' || s.slug as link,
           (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.store_id = s.id and r.direction = 'buyer_to_seller') as rating,
           (select count(*)::int from public.reviews r where r.store_id = s.id and r.direction = 'buyer_to_seller') as reviews,
           s.verification_level::int as vlevel
      from public.stores s
     where p_kind = 'seller' and exists (select 1 from public.listings l where l.store_id = s.id and l.status = 'active')
    union all
    -- buyers: public buyer sheet and at least one completed purchase
    select p.id, p.display_name, null, p.avatar_url, '/buyer/' || p.id,
           (select round(avg(r.rating)::numeric, 1) from public.reviews r where r.reviewee_id = p.id and r.direction = 'seller_to_buyer'),
           (select count(*)::int from public.reviews r where r.reviewee_id = p.id and r.direction = 'seller_to_buyer'), 0
      from public.profiles p
     where p_kind = 'buyer' and p.sheet_public and exists (select 1 from public.orders o where o.buyer_id = p.id and o.status = 'completed')
    union all
    -- applicants: open to work; first name + headline only (no contact details)
    select jp.user_id, split_part(jp.full_name, ' ', 1), jp.headline, null, '/jobs/post',
           (select round(avg(r.rating)::numeric, 1) from public.job_reviews r where r.reviewee_id = jp.user_id and r.direction = 'employer_to_applicant'),
           (select count(*)::int from public.job_reviews r where r.reviewee_id = jp.user_id and r.direction = 'employer_to_applicant'), 0
      from public.job_profiles jp
     where p_kind = 'applicant' and jp.open_to_work
    union all
    -- employers: with an open job post
    select j.owner_id, max(j.company_name), max(j.title), null, '/jobs/' || (array_agg(j.id order by j.created_at desc))[1],
           (select round(avg(r.rating)::numeric, 1) from public.job_reviews r where r.reviewee_id = j.owner_id and r.direction = 'applicant_to_employer'),
           (select count(*)::int from public.job_reviews r where r.reviewee_id = j.owner_id and r.direction = 'applicant_to_employer'), 0
      from public.job_posts j
     where p_kind = 'employer' and j.status = 'active'
     group by j.owner_id
  ),
  scored as (
    select c.*, coalesce(f.n, 0) as friends, coalesce(b.b, '{}') as badges, (c.uid in (select user_id from pins)) as pinned,
           coalesce(c.rating, 0) * 2 + ln(1 + c.reviews) * 3 + ln(1 + coalesce(f.n, 0)) * 2 + cardinality(coalesce(b.b, '{}')) * 2 + c.vlevel
             + (('x' || substr(md5(c.uid::text || current_date::text), 1, 4))::bit(16)::int / 65535.0) as score
      from cand c left join fol f on f.id = c.uid left join bad b on b.id = c.uid
     where not exists (select 1 from public.profiles p where p.id = c.uid and p.restricted_until > now())
  )
  select uid, name, sub, img, link, rating, reviews, friends, badges, vlevel, pinned
    from scored order by pinned desc, score desc
   limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;
