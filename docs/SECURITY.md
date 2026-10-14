# Security and scale: what protects MarketplacePH

Plain-language summary of how the site protects users' data and stays up under load, plus the settings to check before each launch. (Last full review: October 2026.)

## How users' data is protected

| Threat | Protection | Where |
|---|---|---|
| Someone reads or changes another user's data | Every database table has row-level security: people only see and change their own rows (or what a deal partner may see). Tested in `tests/rls.test.ts` and friends. | `supabase/migrations` |
| Private files (IDs, job documents, payment proofs) leak | Private storage buckets; files open only through 60-second signed links, and admin views are logged in `document_access_logs`. Uploads are limited by type and size and can only go into the uploader's own folder. | `app/actions/verification.ts`, `lib/order-files.ts`, storage policies |
| Look-alike / "defaced" copies, click-jacking | Pages refuse to load inside other sites (`frame-ancestors 'none'`, `X-Frame-Options: DENY`). | `next.config.ts` |
| Injected scripts (XSS) | React escapes all user text; the app never injects raw HTML; a Content Security Policy only allows our own scripts and our Supabase project. | `next.config.ts` |
| Downgrade to insecure http | HSTS: browsers always use HTTPS for two years. | `next.config.ts` |
| Password guessing / weak passwords | Supabase Auth rate limits; passwords need 8+ characters with letters and numbers (enforced by the server, not just the form). | `supabase/config.toml` (local), Supabase dashboard (live) |
| Spam and flooding | Daily limits on listings, orders, deals, job applications and reports; message speed limit. | database guard functions |
| Duplicate orders (double tap) | Order requests per buyer and store are serialized; a repeat from the same cart is refused. | migration `20261017000002_place_order_once.sql` |
| Fake sign-in links / open redirects | Only same-site redirects are allowed after login (`safeNext`). | `lib/phone.ts`, `app/auth/callback` |
| Leaked secrets | The service-role key is used only in server code after an auth check; `.env*` files are git-ignored; secrets are never in git history. | `lib/supabase/server.ts` |
| Server-to-server endpoints abused | FLAME sync needs a 24+ character secret (constant-time compare); the daily cron needs `CRON_SECRET`. | `app/api/*` |
| Vulnerable libraries | `npm audit --omit=dev` = 0 known vulnerabilities (uuid pinned via `overrides`). | `package.json` |

## How it stays fast with many users

- Public pages are partly pre-built and streamed; each page shows a placeholder instantly on navigation.
- Header badges (notifications, cart, messages, role, plan) come from ONE indexed database call (`my_header_counts`), not six queries that scanned every message on the site.
- Inbox queries name the user's own conversations so indexes are used.
- Vercel runs many copies of the site in parallel as traffic grows; the shared part is the Supabase database. In local tests the database stayed under ~15% busy at 50 simultaneous users while one site process was the limit, which Vercel removes by scaling out.

## Launch checklist (live site)

1. Supabase → Authentication → Sign In / Providers → **Email**: "Confirm email" ON; minimum password length **8**; password requirements **letters and digits**; "Prevent use of leaked passwords" ON (paid plan).
2. Supabase → Authentication → URL Configuration: Site URL `https://marketplaceph.com`; redirect URL `https://marketplaceph.com/auth/callback`.
3. Supabase plan: use **Pro** (or higher) for production traffic; the free plan pauses and has tight limits.
4. Vercel → Settings → Functions → **Function Region**: the region closest to the Supabase project (for a Singapore Supabase project: Singapore `sin1`).
5. Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `FLAME_SYNC_SECRET`.
6. Apply database migrations: `npx supabase db push` (never run `seed.sql` on production).
7. Admin accounts: turn on two-step sign-in (MFA) when it is added to the admin flow.

## Next improvements (not done yet)

- Bot protection (Cloudflare Turnstile CAPTCHA) on sign-up, once traffic warrants it.
- Two-step sign-in (MFA) for admin and moderator accounts.
- Search result counts use exact counting; switch to estimated counts if listings reach the hundreds of thousands.
