-- Item reviews also come from deals agreed in chat (orders.listing_id), not only from cart orders (order_items).
create or replace function public.listing_reviews(p_listing uuid, p_limit integer default 20)
returns table (rating smallint, comment text, reviewer_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.rating, r.comment, public.display_name_of(r.reviewer_id), r.created_at
    from public.reviews r join public.orders o on o.id = r.order_id
   where r.direction = 'buyer_to_seller'
     and (o.listing_id = p_listing or exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.listing_id = p_listing))
   order by r.created_at desc limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
