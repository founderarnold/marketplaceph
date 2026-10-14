-- Friends feed: for an update, `title` now says what `link_slug` points to ('listing' or 'job').
CREATE OR REPLACE FUNCTION public.friends_feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, item_id uuid, actor_id uuid, actor_name text, title text, body text, image_path text, price_type text, price_min numeric, price_max numeric, unit text, link_slug text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select auth.uid() as id),
  friends as (select f.followee_id as id from public.follows f, me where f.follower_id = me.id),
  cutoff as (select coalesce(p_before, now()) as t)
  select * from (
    select 'update'::text, u.id, u.author_id, public.display_name_of(u.author_id), case when u.listing_id is not null then 'listing' when u.job_id is not null then 'job' end, u.body, null::text,
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
$function$;
