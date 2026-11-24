# MarketplacePH Jobs 2.0 — Pilot runbook (Prompt 7)

Status: prepared 25 Nov 2026 from source and local checks. **Nothing here has been deployed.** Every feature is off until
its flag is named in `JOBS2_FLAGS` (server-side Vercel env var). Named owners are placeholders for the owner to fill in.

## 1. Owners and support

| Role | Name | Responsibility |
|---|---|---|
| Product owner | _(owner to name)_ | Go/no-go, campaign ramp, public copy |
| Technical lead | _(owner to name)_ | Migrations, flags, deploys, rollback |
| Employer reviewer(s) | _(owner to name)_ | `/admin/employer-reviews`, Credible Employer badges (Admin → Badges) |
| Support / moderator | _(owner to name)_ | Reports, scam posts (Admin → Jobs → Remove), applicant help |
| FLAME PH chapter leads | _(per pilot chapter)_ | Share links with their opaque chapter code `ch` |

Support path: applicant or employer → in-app report / MarketplacePH page messages → support → technical lead for Sev 1–2.

## 2. What ships, by flag

| Flag | Branch | What it turns on | Needs migration |
|---|---|---|---|
| `jobs2_landing` | `feat/jobs2-p2-landing` | /jobs landing, location search, zero-match actions, attribution, **all funnel events** | `20261125000002` (+ `20261125000004` for the full event list) |
| `jobs2_sso_link` | `feat/jobs2-p3-onboarding` | /jobs/start onboarding shell, honest FLAME PH account copy (no SSO logic change) | — |
| `jobs2_profile_wizard` | `feat/jobs2-p4-profile-resume` | 5-step autosaving profile wizard | — |
| `jobs2_resume_builder` | `feat/jobs2-p4-profile-resume` | ATS resume, print / save as PDF on device | — |
| `jobs2_matching` | `feat/jobs2-p5-apply-match` | Match reasons, review-before-apply, applications timeline | — |
| `jobs2_employer_pipeline` | `feat/jobs2-p6-employer-pipeline` | Employer counts/filters, stale reminder, interview invites, hides age/sex/civil status from employers, employer review queue | `20261125000003` |
| (always) | `feat/jobs-starter-posts` | Admin draft editor and publish/unpublish; 19 starter drafts (seed, run by owner) | `20261125000001` + seed |

Branches are stacked: P3 is based on P2, P4 on P3, and so on up to P7. Merge them in order (P2 → P7). The starter-posts
and audit branches are separate and based on `main`.

## 3. Deploy order (owner / technical lead)

1. Backup the production database (Supabase → Backups) and note the time.
2. Apply to **staging** first, in order: `20261125000001`, `20261125000002`, `20261125000003`, `20261125000004`.
   Check: `select * from public.job_funnel_daily limit 1;` works for an admin and returns nothing for a normal user.
3. Merge the PRs in order; Vercel deploys `main`. All flags still off → no visible change.
4. Production: apply the same migrations, then set `JOBS2_FLAGS` one flag at a time (landing first) and redeploy.
5. Starter posts: run `supabase/seeds/jobs_starter_posts.sql` preview query first, fix any employer it cannot find, run it,
   then fill pay and location in Admin → Jobs → Drafts and publish.

## 4. Go / no-go blockers (any one stops the pilot)

- Any cross-user data exposure (applicant sees another applicant's data; employer sees unshared documents).
- Backup restore or the flag/migration rollback not rehearsed on staging.
- An unresolved Critical item from `docs/JOBS_2_AUDIT.md` (S-7 is fixed only when `jobs2_employer_pipeline` is on).
- Public copy promising jobs, pay, employer safety, or that the FLAME PH account "always" works on MarketplacePH.
- Fewer than the agreed verified supply (plan default: 20 reviewed employers / 50 reviewed active vacancies).
- No named support owner.

## 5. Campaign ramp

| Stage | Audience | Move on when (7 days) | Stop when |
|---|---|---|---|
| 10% | 2–3 pilot chapters (`ch` codes), one Facebook post each | apply_submitted ≥ 30, zero Sev 1, scam reports handled < 24 h | any stop condition (§7) |
| 30% | All pilot chapters + MarketplacePH page | applications per reviewed vacancy ≥ 3, employer response (status change) within 3 days for ≥ 60% | any stop condition |
| 100% | Public campaign | — | any stop condition |

## 6. Daily checks (10 minutes)

- `/admin/jobs-funnel?days=7`: landing sessions → job views → sign-up started → profile ready → applications sent →
  status changes → interviews → hires confirmed. Watch for a sudden drop at one step.
- By source/chapter table: which `ch` codes bring applicants (counts only).
- `/admin/employer-reviews`: anything overdue (> 3 days).
- Admin → Jobs: new posts with fee wording or fake agencies → Remove. Reports queue.
- Applicants waiting > 3 days (employer page reminder) — nudge employers.

## 7. Incident severity and stop conditions

| Sev | Example | Response |
|---|---|---|
| 1 | Data exposure, account takeover, SSO sign-in failing for many users | Turn the related flag off immediately; tech lead within 1 h; owner informed |
| 2 | Applications failing, wizard not saving, admin cannot publish | Flag off if user-facing; fix within 1 day |
| 3 | Copy errors, layout issues on some phones | Fix in next release |

Stop the campaign on any Sev 1, a confirmed job-fee scam that reached applicants, or application failures above 5% of
`apply_start`.

## 8. Rollback (exact steps)

1. **Fast**: remove the flag(s) from `JOBS2_FLAGS` and redeploy. Pages return to the previous behaviour; no data change.
2. Code: revert the merged PR(s) on GitHub (new PR) → Vercel redeploys `main`.
3. Database (only if needed, newest first, after exporting the rows):
   `supabase/rollback/20261125000004_…down.sql`, `…0003…`, `…0002…`, `…0001…`.
   The 0001 rollback restores the original "moderators change status only" rule; drafts already created stay as they are.
4. Starter posts: they are ordinary hidden posts; unpublish or remove them in Admin → Jobs (no SQL needed).

## 9. Test evidence (local, 25 Nov 2026)

Run on each branch: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build` — all passed (see PRs).
Database: each migration and its rollback ran on the **local** Supabase inside a transaction that was rolled back:
event allow-listing (search text, emails, phone-like values dropped), anon cannot read events, employer reviews are
admin-only and append-only, agencies cannot be approved without a checked licence, admins can edit only hidden drafts.
Screens: Playwright screenshots at 280–1440 px in `docs/screenshots` (no horizontal scroll found).

**Not yet done (needs owner access or a staging project):**
- RLS/integration suite (`tests/rls.test.ts`, `tests/jobs.test.ts`) against a Supabase with these migrations applied
  (the suite skips without local keys).
- Applicant/employer/admin authorization matrix on staging; private document access-log check.
- FLAME PH sign-in cases (new, existing, linked, conflicting, expired/tampered ticket, logout everywhere) on staging.
  No SSO code was changed; MarketplacePH has no automated SSO tests (see audit S-22).
- Real Android devices, screen-reader pass, slow-network and interrupted-upload tests.
- Backup restore rehearsal and production smoke test after deploy.
- Events `signup_complete` and `flame_link_result` are allowed by the database but not sent, because that would require
  changing sign-in code.
