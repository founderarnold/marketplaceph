-- New staff roles with the same powers as admin: founder and webmaster.
-- Kept in its own migration because a newly added enum value can't be used in the same transaction.
alter type public.user_role add value if not exists 'founder';
alter type public.user_role add value if not exists 'webmaster';
