# MarketplacePH Jobs 2.0 — Week 1 audit (Prompt 1)

Date: 25 Nov 2026 · Source: `origin/main` at `b71d93e` (Merge PR #12) · Method: source reading and local checks only.

**No production system was touched.** No production database query, no Vercel dashboard/API call, no test records.
Everything that needs production access is listed under **Configuration unverified** with the exact read-only check to run.

Status key:

| Status | Meaning |
|---|---|
| **Verified live** | Seen working on the production site/data. *Nothing in this audit is in this state: production was not accessed.* |
| **Verified in source** | Read in the code/migrations on `origin/main`; local tests or a local database confirm it where noted. |
| **Configuration unverified** | Depends on Vercel/Supabase production settings or data that were not inspected. |
| **Proposed** | Not built. Recommended work, mapped to a Jobs 2.0 phase. |

Severity: **Critical** (data exposure/legal risk; blocks pilot) · **High** (blocks a pilot goal) · **Medium** (should fix before campaign) · **Low**.

---

## 1. Production truth (needs owner access)

| # | Item | Status | How to verify read-only | Owner | Release gate |
|---|---|---|---|---|---|
| P-1 | Vercel project, production domain `www.marketplaceph.com`, production branch and deployed commit | Configuration unverified | Vercel → Project → Deployments: confirm Production = `main`, commit `b71d93e` or later | Owner / Tech lead | Before P2 merge |
| P-2 | Env var **names** present in Production (values never printed): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SSO_SECRET_MARKETPLACEPH` (or legacy `SSO_SECRET`), `FLAME_SYNC_SECRET`, `CRON_SECRET`, `TRADE_ASSURANCE_ENABLED`, `NEXT_PUBLIC_GOOGLE_LOGIN`, `NEXT_PUBLIC_PHONE_LOGIN`, `NEXT_PUBLIC_FLAME_ADS_*`, and the new `NEXT_PUBLIC_JOBS2_*` flags (all unset = off) | Configuration unverified | Vercel → Settings → Environment Variables, names only | Owner | Before any flag is turned on |
| P-3 | Supabase project identity and applied migrations (expect through `20261109000001_complete_psgc_locations`) | Configuration unverified | Supabase → Database → Migrations, or `select version from supabase_migrations.schema_migrations order by 1` | Tech lead | Before applying `20261125000001` |
| P-4 | Backups / point-in-time restore enabled; last restore rehearsal | Configuration unverified | Supabase → Database → Backups | Owner | Before any migration |
| P-5 | Live row counts: users, job_profiles (with `consent_at`), job_posts by status, job_applications by status, job_documents, job_messages, badge_requests (`credible_employer`, `good_applicant`) by status, reports, job_reviews | Configuration unverified | One read-only SQL in the SQL editor (`select status, count(*) … group by 1` per table) | Tech lead | Week 1 go/no-go |
| P-6 | Storage bucket `job-documents` is private in production and policies match the migration | Configuration unverified | Supabase → Storage → bucket settings + policies | Tech lead | Before P4 |
| P-7 | FLAME PH shared sign-in works both ways for new and existing accounts on production | Configuration unverified | Manual test with two staff test accounts on production (approved test records only) | Owner | Before any "one account" claim in P3 copy |

---

## 2. Current-state matrix (source)

| # | Area | Finding | Status | Severity | Fix recommendation | Phase / gate |
|---|---|---|---|---|---|---|
| S-1 | Public board `/jobs` | Signed-out visitors can browse and search; filters `q`, `category`, `type`, `setup`, `page` (20 per page, max 50 pages); only `active` posts before deadline. Search matches title and company only (not description or location). | Verified in source | — | Keep URL params; add location filter (P2). | P2 |
| S-2 | Search input safety | `q` is cut to 80 chars and `%`, `,`, `(`, `)` are replaced before building the PostgREST `or()` filter. | Verified in source | Low | Keep; add test for odd characters in P2. | P2 |
| S-3 | Empty / zero-match state | One generic message and a "Post a job" button; no path for job seekers (profile, alerts, learning). | Verified in source | High | Useful zero-match actions + "notify me" capture. | P2 |
| S-4 | Job detail `/jobs/[id]` | Public; shows pay, location, setup, employer trust stats, comments, scam warning (`ShieldAlert`). Metadata is a fixed "Job details" title, no canonical URL, no description. | Verified in source | Medium | Per-job title/description and canonical. | P2 |
| S-5 | Protected routes | `proxy.ts` redirects signed-out users from `/jobs/profile`, `/jobs/applications`, `/jobs/post`, `/jobs/employer`, `/jobs/messages`; real enforcement is RLS + server code. | Verified in source | — | — | — |
| S-6 | Job profile | `job_profiles` stores full name, headline, phone, email, **birthdate, sex, civil status**, PSGC location, `address_note`, about, education, skills (≤20), experience years, desired roles, job types, expected salary, work history (≤10), open-to-work, `consent_at`. One long form at `/jobs/profile`. | Verified in source | — | Wizard over the same table (P4). | P4 |
| S-7 | **Sensitive data shown to employers** | `/jobs/employer/[id]` shows each applicant's **age (from birthdate), sex and civil status**; RLS lets an employer read the whole `job_profiles` row of anyone who applied to them. These are not job-relevant and invite discrimination (RA 10911 Anti-Age Discrimination in Employment; Data Privacy Act proportionality). | Verified in source | **Critical** | Stop rendering age/sex/civil status on the employer screen (UI change, no data change) and select only job-relevant columns; later expose a restricted view/RPC instead of the whole row. Never use these fields in readiness or matching. | Before pilot (fix in P4/P5) |
| S-8 | Documents | Private bucket `job-documents` (≤5 MB; JPG/PNG/WebP/PDF); employer sees only documents the applicant chose for that application (`employer_can_see_doc`), opened through `job_doc_open()` which logs each view in `job_doc_access_logs` (admin-read only). Kinds include barangay/police/NBI clearances. | Verified in source (local RLS tests exist: `tests/jobs.test.ts`) | Medium | Default resume must exclude clearances; consider expiring clearances after hire/reject. | P4 |
| S-9 | Applications | Created only via `apply_to_job()` (unique per post+applicant, ≤25 docs); status via `set_application_status()`; withdraw via `withdraw_application()`; employer and applicant both notified (`notify()`); applicant confirms a hire (`confirm_hire`). No review screen before submit; `/jobs/applications` shows status badge only (no timeline / next step). | Verified in source | Medium | Review screen + timeline. | P5 |
| S-10 | Messaging | `job_threads` / `job_messages` per application with rate-limit guard and system cards. | Verified in source | — | Reuse for interview invites. | P6 |
| S-11 | Anti-scam guards | `job_posts_guard()` blocks fee wording, requires agency licence no., caps 25 open posts per owner; job form requires a no-fees checkbox. | Verified in source + local DB | — | Keep; add "agency licence verified" review step. | P6 |
| S-12 | Employer trust | `badge_requests` / admin approval for `credible_employer`, `good_applicant`; job reviews after hire. The credible-employer badge is **not shown on job cards or the job detail page**. No review queue for unverified employers' posts. | Verified in source | High | Show badge on job card/detail with scoped wording; review queue. | P6 |
| S-13 | Admin | Admin → Jobs lists latest 60 posts with Remove/Restore; DB trigger lets moderators change only status. (Branch `feat/jobs-starter-posts` adds draft editing/publishing for full admins.) | Verified in source | Medium | Merge starter-posts branch after review. | Task B |
| S-14 | Employer dashboard | Per-post counts (total, new) computed in the page; status buttons per applicant; no filters, no stale reminders, no response-time metric. | Verified in source | Medium | Pipeline counts/filters. | P6 |
| S-15 | Matching | None. Chronological list only. | Verified in source | — | Explainable cues, never hide jobs. | P5 |
| S-16 | Resume | None. | Verified in source | — | ATS template with print/PDF. | P4 |
| S-17 | Analytics / funnel | No product analytics or event table; only FLAME Ads impression/click calls in `components/ads`. | Verified in source | High | Privacy-safe funnel events. | P2 (landing events) / P7 |
| S-18 | Attribution | `/r/[code]` + `affiliate_links/clicks/commissions` are **tied to marketplace listings and orders** (code → listing, 30-day cookie for order commission). Not suitable for job/chapter attribution without changing their meaning. | Verified in source | — | Separate, PII-free UTM + opaque chapter code for jobs (no reuse of affiliate tables). | P2 |
| S-19 | Feature flags | No flag system. | Verified in source | High | Minimal env-based `jobs2_*` flags, all off by default. | P2 |
| S-20 | i18n | `messages/en.json` and `messages/fil.json` both 2,363 keys, no missing keys either way. | Verified in source (script check) | — | Keep parity test for new keys. | All |
| S-21 | FLAME PH SSO | `lib/flame-sso.ts`: hub = `www.flameph.org`; one-time tickets bound to the browser by `state`+`nonce` in a `__Host-` cookie; server-to-server swap signed with this site's key (`SSO_SECRET_MARKETPLACEPH`, legacy `SSO_SECRET`); accounts matched by verified email; every-minute "logout everywhere" check in `proxy.ts`; everything off until a key is set. | Verified in source | — | **Do not change** in Jobs 2.0. P3 adds only copy + a flag. | P3 |
| S-22 | SSO tests | MarketplacePH has **no automated SSO tests**; the hub side has `tests/ecosystem-sso.test.mjs` in flameph-web2 (9 pass / 1 fail on Windows locally, same before and after this work). | Verified in source | Medium | Add contract tests for ticket/state/nonce handling (separate, auth-owner-approved change). | P3 (separate PR) |
| S-23 | `.env.example` | Missing `SSO_SECRET_MARKETPLACEPH`, `SSO_SECRET`, `CRON_SECRET`. | Verified in source | Low | Add names (no values). | P2 |
| S-24 | Public claims | Board says jobs are free for seekers and employers (true in source: no payment step for jobs). No claim of guaranteed jobs found in jobs pages. Shared-account copy must stay conditional until P-7 is verified. | Verified in source | Medium | Review all new copy against this audit. | P2/P3 |
| S-25 | Automated tests | `npx vitest run`: 9 files, 51 passed, 106 skipped. All DB/RLS tests (incl. `tests/jobs.test.ts`, `tests/rls.test.ts`) **skip unless a local Supabase URL and keys are provided**, so CI as configured does not exercise RLS. | Verified locally | High | Run RLS tests against local Supabase in CI or before every jobs release. | P7 |

---

## 3. End-to-end behaviour by role (source)

| Role | Can do today | Gaps for Jobs 2.0 |
|---|---|---|
| Signed-out visitor | Browse/search `/jobs`, open a job, read comments; apply prompts sign-in | No location search, weak zero-match, no attribution, no "notify me" |
| Applicant | Build profile (one long form), upload private documents, apply with chosen docs and a note, message employer, withdraw, confirm hire, review employer | No wizard/autosave, no readiness checklist, no resume, no review screen, no timeline |
| Employer | Post jobs (fee guard, licence for agencies), see applicants and shared docs (logged), change status, message, review applicant | Sees age/sex/civil status (S-7), no pipeline filters, no verification flow tied to posts |
| Admin / moderator | Remove/restore posts, approve badges, read doc-access logs | No employer review queue, no draft editing (Task B branch adds it) |

---

## 4. Duplicate-account and identity risks

- Accounts are matched to the FLAME PH hub by **verified email**. A person who signed up here with phone OTP (`NEXT_PUBLIC_PHONE_LOGIN`) and later uses FLAME PH with an email may end up with two MarketplacePH accounts. *Configuration unverified:* whether phone login is on in production.
- Job profile data lives per MarketplacePH account; a duplicate account means a second, empty job profile. Recommend a support runbook entry (P7) rather than an automated merge.

---

## 5. Release gates for Jobs 2.0

1. **Go/no-go for the pilot**: S-7 fixed; P-1…P-7 checked by the owner; RLS tests run against local Supabase and pass; flags default off.
2. Every migration additive with a rollback file; applied to staging first; backup taken before production (owner applies).
3. No public "one account" promise until P-7 is verified.

## 6. What this audit did not do

- No production reads or writes, no Vercel or Supabase dashboard access, no test records.
- No changes to SSO code. No fixes (Prompt 1 is audit-only).
