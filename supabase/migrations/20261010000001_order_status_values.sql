-- Phase 3 (1/2): order lifecycle states. (New enum values can't be used in the transaction that adds them.)
alter type public.order_status add value if not exists 'requested';
alter type public.order_status add value if not exists 'quoted';
alter type public.order_status add value if not exists 'payment_submitted';
alter type public.order_status add value if not exists 'paid';
alter type public.order_status add value if not exists 'packed';
alter type public.order_status add value if not exists 'shipped';
alter type public.order_status add value if not exists 'delivered';
