-- Phase 2 (1/2): extra report/case states. New enum values can't be used in the same transaction
-- that adds them, so the main Phase 2 migration comes next.
alter type public.report_status add value if not exists 'awaiting_response';
alter type public.report_status add value if not exists 'under_review';
alter type public.report_status add value if not exists 'warning';
alter type public.report_status add value if not exists 'restricted';
alter type public.report_status add value if not exists 'flagged';
