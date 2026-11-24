# Jobs 2.0 — P2 landing, attribution and events

Flag: `jobs2_landing` (set `JOBS2_FLAGS=jobs2_landing` in Vercel, server-side env). **Off by default.**
With the flag off, `/jobs` and `/jobs/[id]` behave exactly as before (the `loc` parameter is ignored).

## What the flag turns on

- `/jobs`: headline "Hanap trabaho? Simulan natin dito.", keyword + location (city, province, or "remote") search,
  "Explore jobs" and "Build my free profile", free-use note and job-scam reminder. Existing `q`, `category`, `type`,
  `setup`, `page` URLs keep working; `loc` is new.
- Zero-match / empty board: build profile, save this search (signed-in members; visitors are sent to sign in and back),
  related roles, FLAME PH Academy link, "Post a job".
- Metadata: canonical `/jobs`; per-job title, description and canonical on `/jobs/[id]` (active posts only).
- Attribution: first-touch `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and an opaque chapter code `ch`
  are kept in the first-party cookie `mph_jobs_attr` for 30 days, so they survive sign-up and login.
  Values must be 1–40 chars of `a-z 0-9 _ . -`; emails, phone-like numbers, names with spaces and every other parameter
  (e.g. `fbclid`) are dropped. Checked again in the database function.
- Events (table `job_funnel_events`, written only by `record_job_event()`): `jobs_landing_view`, `job_search`,
  `job_view`, `signup_start`, `referral_attribution`. Props are allow-listed: `has_q`, `has_loc` (booleans), `results`
  (bucket 0 / 1-5 / 6-20 / 21+), `category`, `job_id`, `source`. **Search text is never stored in events.**
  Session = random per-browser id cookie `mph_jobs_sid`; `user_id` only when signed in. Only full admins can read.

## Why not reuse the affiliate tables

`/r/[code]` and `affiliate_links/clicks/commissions` are tied to a marketplace listing and to order commissions.
Using them for job/chapter attribution would change their meaning, so P2 adds a separate, PII-free path.

## Deploy (owner)

1. Staging: apply `supabase/migrations/20261125000002_jobs2_landing_events.sql`; set `JOBS2_FLAGS=jobs2_landing`; test.
2. Production: backup → apply the migration → merge → set the flag. The page works without the migration
   (events and saved searches just fail quietly), but do not turn the flag on in production before the migration.

## Rollback

1. Remove `jobs2_landing` from `JOBS2_FLAGS` and redeploy (instant, no data change).
2. Only if needed: export, then run `supabase/rollback/20261125000002_jobs2_landing_events.down.sql`.

## Facebook comment and PM copy (drafts — owner to approve before use)

Use with a link like `https://www.marketplaceph.com/jobs?utm_source=facebook&utm_medium=comment&utm_campaign=<campaign>&ch=<chapter-code>`.
Chapter codes are short and opaque (e.g. `pmp01`), never a person's name or number.

**Public comment (Taglish)**
> Salamat sa interes! 🙌 Tingnan ang mga bukas na trabaho at gumawa ng libreng profile dito: <link>
> Libre ito. Hindi ka sisingilin para mag-apply. Kapag may humingi ng bayad, huwag magpadala at i-report.

**Private message (Taglish)**
> Hi! Salamat sa pag-message. Puwede kang maghanap ng trabaho ayon sa lugar mo dito: <link>
> Tip: gumawa ng libreng job profile para mas mabilis kang makapag-apply. Walang bayad ang pag-apply,
> at hindi namin hinihingi ang password o OTP mo.

**Public comment (English)**
> Thanks for your interest! Browse open jobs and build a free profile here: <link>
> It's free, and you never pay to apply. If anyone asks you for money, don't send it, and report the post.

Do not promise a job, a salary, or that a FLAME PH account automatically works on MarketplacePH (see P3 / audit P-7).
