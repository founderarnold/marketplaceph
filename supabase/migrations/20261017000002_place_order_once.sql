-- Prevent duplicate orders from a double-tapped "Place order": requests from one buyer to one store are serialized with
-- an advisory lock, and (when the app passes p_from_cart) every item must still be in the buyer's cart. The first
-- request removes them, so the second one stops with a friendly message instead of creating a copy of the order.
drop function public.place_order(uuid, jsonb, jsonb, text, uuid, text);

create function public.place_order(p_store uuid, p_items jsonb, p_delivery jsonb, p_urgency text DEFAULT 'standard'::text, p_preferred uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text, p_from_cart boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid(); s record; it jsonb; l record; qty int; price numeric; oid uuid; convo uuid; sub numeric := 0; qsum int := 0; summ text;
begin
  if uid is null then raise exception 'Please sign in'; end if;
  -- One request at a time per buyer and store: a double-tapped "Place order" waits here for the first one to finish.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_store::text, 0));
  -- From the cart: every item must still be in the cart (the first request removes them), so a duplicate stops here.
  if p_from_cart and exists (select 1 from jsonb_array_elements(p_items) x where not exists (
       select 1 from public.cart_items c where c.user_id = uid and c.listing_id = (x ->> 'listing_id')::uuid)) then
    raise exception 'This order was already sent. Check My orders.' using errcode = 'P0001';
  end if;
  perform public.assert_not_restricted(uid);
  select * into s from public.stores where id = p_store;
  if not found then raise exception 'Store not found'; end if;
  if s.owner_id = uid then raise exception 'You cannot order from your own store'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Add at least one item'; end if;
  if p_urgency not in ('standard', 'urgent') then raise exception 'Invalid urgency'; end if;
  if (select count(*) from public.orders where buyer_id = uid and is_full_flow and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily order limit reached' using errcode = 'P0001';
  end if;
  if (select count(*) from public.orders where buyer_id = uid and store_id = p_store and status in ('requested', 'quoted')) >= 3 then
    raise exception 'You already have open requests with this store' using errcode = 'P0001';
  end if;
  if p_preferred is not null and not exists (select 1 from public.shipping_methods where id = p_preferred and (owner_id is null or owner_id = uid)) then
    raise exception 'Invalid shipping method';
  end if;
  if jsonb_typeof(p_delivery) <> 'object' or coalesce(p_delivery ->> 'recipient_name', '') = '' or coalesce(p_delivery ->> 'phone', '') = '' or coalesce(p_delivery ->> 'address', '') = '' then
    raise exception 'Delivery name, phone and address are required';
  end if;

  perform set_config('app.order_fn', '1', true);
  insert into public.orders (store_id, seller_id, buyer_id, summary, quantity, amount, status, is_full_flow, urgency, buyer_note, preferred_method_id)
    values (p_store, s.owner_id, uid, 'New order', 1, 0, 'requested', true, p_urgency, left(nullif(trim(p_note), ''), 500), p_preferred)
    returning id into oid;

  for it in select * from jsonb_array_elements(p_items) loop
    select li.* into l from public.listings li where li.id = (it ->> 'listing_id')::uuid and li.store_id = p_store and li.status = 'active';
    if not found then raise exception 'An item is no longer available'; end if;
    qty := (it ->> 'quantity')::int;
    if qty is null or qty < l.moq then raise exception 'Minimum order for "%" is % %', l.title, l.moq, l.unit; end if;
    if l.stock_status = 'out_of_stock' then raise exception '"%" is out of stock', l.title; end if;
    price := case
      when l.price_type = 'fixed' then coalesce((select t.unit_price from public.listing_price_tiers t where t.listing_id = l.id and t.min_qty <= qty order by t.min_qty desc limit 1), l.price_min)
      else null end;   -- range / message: the seller sets the price in the quote
    insert into public.order_items (order_id, listing_id, title, unit, quantity, unit_price) values (oid, l.id, l.title, l.unit, qty, price);
    qsum := qsum + qty;
    if price is not null then sub := sub + price * qty; end if;
  end loop;

  summ := left((select string_agg(title || ' ×' || quantity, ', ' order by title) from public.order_items where order_id = oid), 200);
  update public.orders set summary = coalesce(nullif(summ, ''), 'New order'), quantity = qsum, amount = sub where id = oid;

  insert into public.order_delivery (order_id, recipient_name, phone, address, landmark, region_code, province_code, city_code)
    values (oid, left(p_delivery ->> 'recipient_name', 80), left(p_delivery ->> 'phone', 20), left(p_delivery ->> 'address', 300),
            left(nullif(p_delivery ->> 'landmark', ''), 200), nullif(p_delivery ->> 'region_code', ''), nullif(p_delivery ->> 'province_code', ''), nullif(p_delivery ->> 'city_code', ''));

  select id into convo from public.conversations where buyer_id = uid and store_id = p_store and listing_id is null;
  if convo is null then insert into public.conversations (buyer_id, store_id) values (uid, p_store) returning id into convo; end if;
  update public.orders set conversation_id = convo where id = oid;

  delete from public.cart_items where user_id = uid and listing_id in (select listing_id from public.order_items where order_id = oid);
  perform public.notify(s.owner_id, 'order_requested', jsonb_build_object('summary', left(summ, 80)), '/orders/' || oid);
  return oid;
end $function$;

revoke all on function public.place_order(uuid, jsonb, jsonb, text, uuid, text, boolean) from public, anon;
grant execute on function public.place_order(uuid, jsonb, jsonb, text, uuid, text, boolean) to authenticated, service_role;
