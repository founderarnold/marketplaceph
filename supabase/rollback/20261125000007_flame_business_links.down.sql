-- Rollback for 20261125000007_flame_business_links.sql. Stores filled from FLAME PH stay as they are; only the link
-- records (which listing each store came from, and the consent time) are removed. Export them first if needed.
drop table if exists public.flame_business_links;
