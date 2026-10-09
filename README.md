# MarketplacePH

MSME-first online marketplace for the Philippines — the Market Access / Growth Engine of the FLAME PH MSME Ecosystem.

> **Post for FREE. Find Customers. Buy Local. Sell Nationwide. Grow Together.**

**Status: all five phases built — 1 (Core Marketplace), 2 (Trust Layer), 3 (Orders & Transactions), 4 (Business Tools) and 5 (Growth & Integrations).** See [CHANGELOG.md](CHANGELOG.md) for what's built and what's next.

## Stack

| Area | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components + Partial Prefetching), React 19, TypeScript |
| UI | Tailwind CSS 4, brand tokens from the logo (cobalt blue `#0b4fd1` + orange `#f97316`), hand-written shadcn-style primitives in `components/ui` |
| Backend | Supabase: Postgres + RLS, Auth, Storage, Realtime |
| Data access | `supabase-js` with generated types (`lib/supabase/database.types.ts`), plain SQL migrations |
| i18n | English (default) + Filipino/Taglish, `messages/{en,fil}.json`, language toggle (cookie) |
| PWA | `app/manifest.ts`, `public/sw.js` (network-first, offline page), maskable icons |
| Tests | Vitest — unit tests + RLS/permission/due-process integration tests against local Supabase (124 tests) |

> **This is not the Next.js you may know.** Next 16 renames Middleware to **Proxy** (`proxy.ts`), requires `<Suspense>` around request-time data (cookies, params, searchParams) when Cache Components is on, and makes `params`/`searchParams` promises. Read `node_modules/next/dist/docs/` before changing routing/caching code (see `AGENTS.md`).

## Setup (local)

Requirements: **Node 22+** (tested on 24), **Docker Desktop** running (on Windows this needs WSL2), Git.

```bash
npm install

# 1. Start the local Supabase stack (Postgres, Auth, Storage, Realtime). First run downloads images.
npm run db:start

# 2. Create .env.development.local from the keys it prints (see .env.example)
npx supabase status -o env
#    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
#    NEXT_PUBLIC_SITE_URL=http://localhost:3000
#    SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>   # server only; used for account deletion + test cleanup

# 3. Apply migrations + seed data (also re-runnable any time to restore a clean slate)
npm run db:reset

# 4. Run the app
npm run dev        # http://localhost:3000
```

`.env.development.local` overrides `.env.local` in `next dev`, so your hosted-project keys in `.env.local` are never used locally. **Never commit real keys** (`.env*` is git-ignored except `.env.example`).

### Demo accounts (local only)

| Who | Login |
|---|---|
| Admin | `admin@marketplaceph.test` / `password123` |
| Buyer | `buyer@marketplaceph.test` / `password123` |
| Sellers (9 demo stores) | `seller1@…` to `seller9@marketplaceph.test` / `password123` |
| Phone OTP (no SMS provider yet) | `0917 111 1111`, `0917 222 2222` or `0917 333 3333`, code **123456** |

Seed data: 9 Philippine sample stores (every seller type, verification levels 1–3), 27 listings with wholesale tiers, 12 categories, banned-keyword list, and a starter set of regions/provinces/cities.

### Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit + RLS integration tests (needs local Supabase running and seeded) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase lifecycle (`db:reset` = migrations + seed) |
| `npm run db:types` | Regenerate `database.types.ts` after changing the schema |

## Project layout

```
app/                    routes (App Router) — page.tsx, search, listing/[id], store/[slug], login,
                        sell/new, my/listings, messages, favorites, account, admin
app/actions/            server actions (auth, sell, engage, account, admin, locale) — validated with zod
components/{ui,layout,listing,sell,chat,auth,account}
lib/                    supabase clients, i18n, search filter logic, formatting, image + moderation helpers
messages/               en.json, fil.json
supabase/migrations/    schema, RLS, triggers, storage buckets
supabase/seed.sql       demo data (dev only)
tests/                  unit.test.ts, rls.test.ts
proxy.ts                session refresh + optimistic redirect for signed-in-only routes
```

## Design decisions worth knowing

- **Security lives in the database.** RLS is enabled on every table. Permissions are tested in `tests/rls.test.ts` (anon, buyer, seller, admin personas). Notable guarantees: phones/emails are never public (`public_profiles` view exposes only name + avatar); chats are visible **only** to the two participants (not even admins); sellers can't self-verify or undo a moderator takedown; users can't promote themselves.
- **Abuse limits are enforced in Postgres** (so they apply no matter which client calls): 20 messages/min, 10 reports/day, 100 listings/day. Signup/OTP limits come from Supabase Auth (`[auth.rate_limit]` in `supabase/config.toml`).
- **Audit log:** every admin/moderator write on listings, stores, categories, banned keywords, reports and profiles is recorded by DB triggers into `audit_logs`.
- **Banned items:** `banned_keywords` blocks matching listings at write time; admins manage the list. Image moderation is a provider-agnostic hook (`lib/moderation.ts`) — currently type/size checks only.
- **Low-bandwidth images:** photos are compressed in the browser (≤1280px WebP) and a 400px thumbnail is uploaded beside each (`<name>_t.webp`). Cards load thumbnails.
- **No payments.** MarketplacePH does not hold funds. This is stated in the footer and chat safety tips.
- **Privacy (RA 10173):** minimal collection; `/account/export` downloads everything we hold; account deletion cascades through all owned data (needs `SUPABASE_SERVICE_ROLE_KEY`); `private-docs` bucket exists but has no user policies yet (Phase 2 will add a reviewed upload path with access logging).
- **Public flags:** Phase 1 reports are private intake only. Nothing is ever shown publicly about a user. Public watchlist entries arrive in Phase 2 with notice, response window, admin review and appeal.
- **Locations:** the seeded location list is a **curated subset** (17 regions, 26 provinces, 43 cities) with short stable keys, not the full official PSGC. Importing the full PSGC (including barangays if wanted) is a Phase 2 task and should be done before real listings exist, since codes are foreign keys.

## Phase 2: Trust Layer — how it works

- **Verification levels:** Phone (automatic, when the owner signed in by OTP) → ID (government ID + selfie) → Business (DTI/SEC/CDA + BIR COR + Mayor's permit; FDA optional). Owners submit at `/sell/verify`; admins review in **Admin → Verification**. Documents go to a private bucket that **no one can read through the API**; admins open them through a server action that writes a `document_access_logs` row first and returns a 60-second signed URL. Documents are scheduled for deletion 90 days after approval (30 after rejection), and an admin can purge expired ones from the same tab.
- **Deals → reviews → metrics:** a seller records a deal from a chat (only possible once the buyer has written in that chat); the **buyer confirms** it; then each side can leave one review (60-day window, optional photos). Trust figures are computed live in SQL (`store_trust`, `user_trust`) from confirmed deals only, with amounts shown as ranges. Phase 3 grows `orders` into the full order flow.
- **Badges** (Fast Responder, Top Seller, Reliable Buyer) are derived from live data by `store_badges` / `buyer_badges`, so they can't go stale. Seller type, verification level and years in business are shown alongside.
- **Reports → cases (due process):** a report starts private. An admin *opens the case*, which notifies the reported user and starts a response window (3–30 days). The database refuses any decision other than dismissal until the user has responded or the window has closed, requires a note the user can read, and only a full **admin** (not a moderator) can publish a flag. Outcomes: dismissed, warning, temporary restriction (blocks posting, chatting and deals) or *Flagged after review*. The reported user sees the allegation and the decision but never the reporter, and sees evidence only if an admin marks it shareable. They can appeal within 30 days; a different admin reviews where possible, and overturning revokes the flag or restriction.
- **Watchlist and "Check muna bago bayad" (`/check`):** flags carry a neutral public message, expire (default 12 months) and have a review date. Lookup is **exact-match only** (phone in any PH format, GCash name, store name or slug), so the list can't be browsed, and it returns no allegation details. "No flag found" is never presented as "safe".
- **Information sheets:** printable one-pagers at `/store/<slug>/sheet` and `/buyer/<id>`. Buyer sheets are private by default (visible to the buyer, admins and sellers they chat with) unless the buyer opts in on the account page.
- **Notifications:** in-app bell and `/notifications` for deals, reviews, verification and case events (created only by database functions).

Demo data includes 24 confirmed deals and reviews for Cebu Sweet Mango Co. (earns Top Seller), a Reliable Buyer, and one clearly fictional watchlist entry: try `/check?q=0917 000 9999`.

## Phase 3: Orders & Transactions — how it works

**MarketplacePH never holds money.** Buyers pay sellers directly (GCash, Maya, bank transfer or COD) and upload proof; sellers confirm receipt. Escrow stays out until a licensed payment partner exists.

1. **Cart → request.** Buyers add items to a cart (grouped by seller, wholesale tiers and MOQ applied), then request an order from one seller with delivery details, urgency and an optional preferred courier.
2. **Quote.** The seller confirms what they can supply, sets the final price per item and the shipping fee/method, and sends a quote valid for 1–14 days.
3. **Pay + proof.** The buyer sees the seller's payment accounts (only once a quote exists), pays outside the platform, then uploads a screenshot and the reference number. COD skips the proof.
4. **Confirm receipt.** The seller confirms or rejects the payment (a rejection returns the order to "quoted" and counts against the buyer's payment reliability).
5. **Pack with photo proof.** A packing checklist (every available item must be ticked) plus 1–6 photos. Timestamps are set by the database, so they can't be backdated.
6. **Ship.** Method-specific fields: tracking number / booking link (couriers, Lalamove, Grab…), driver and plate (on-demand, trucking, van/jeep), and for **bus terminal-to-terminal** the bus line, plate, from/to terminals, ETA and a waybill photo.
7. **Deliver → confirm → review.** The seller marks it delivered; the buyer confirms receipt; both can then review (Phase 2 rules).
8. **Reorder.** One tap copies a past order's items into the cart at *today's* price/stock; items that are gone or out of stock are skipped, quantities below the current MOQ are raised, and the buyer is told what changed.
9. **Disputes.** Either side can open one on a paid order (or within 14 days after completion) with evidence. The other side gets 3 days to respond; only an **admin** can resolve (buyer's favour cancels the order, seller's favour completes it, partial/no-fault lets the admin choose), with a note both sides read. Disputes lost by a seller raise their **dispute rate**; open disputes never count.

**Shipping methods are configurable by sellers *and* buyers.** A built-in list (Lalamove, Grab Express, Transportify, Borzo, J&T, LBC, Ninja Van, Flash, JRS, 2GO, SPX, trucking, bus cargo, van/jeep, pickup) is seeded. At **/my/shipping** a seller ticks which methods their store supports and can override them per listing; **anyone can add their own** couriers, truckers or bus lines (limit 25). A custom method is private to its owner; it becomes visible to the other party only on an order where it is named, so a buyer's trusted trucker can be used by the seller for that buyer's order. Sellers also manage their payment accounts there.

**Recommended shipping** (`lib/shipping.ts`) is rule-based: distance (same city / province / island / across islands), size (weight when the seller entered it, else quantity) and urgency decide which *kinds* of shipping to suggest (e.g. no buses or vans across islands; trucking with sea freight for bulk). It is a guide, not a price quote, and is unit-tested.

**Safety design:** every status change goes through a SECURITY DEFINER function that checks who may act from which state; direct edits to orders are blocked for both parties. Payment proofs, packing photos, waybills and dispute files live in a private bucket and are shown only to the two parties via short-lived signed URLs; admins open them through a logged, 60-second link. Delivery addresses are visible only to the two parties (and admins during a dispute). The Phase 2 "record a deal from chat" shortcut still exists for sales arranged outside the platform and feeds the same trust metrics.

Demo data: three orders between Buyer Demo and Cebu Sweet Mango Co. wait at *requested*, *quoted* and *paid* so each side can be tried immediately (log in as `buyer@…` / `seller2@…`).

## Phase 4: Business tools — how it works

Everything lives under **/business** (also linked from the header and the account page).

| Tool | What it does | Unlocks at |
|---|---|---|
| **Customers (seller CRM)** | Built automatically from orders: totals, order history, last phone used, private notes and tags | Apprentice (free) |
| **Suppliers (buyer)** | Everyone you've bought from, with spend, favourites, private notes/tags and **one-tap reorder** | Apprentice (free) |
| **Inventory** | Stock counts, low-stock alerts (per-listing threshold, default 5), automatic "Out of stock" at 0. Stock drops when you confirm a payment (or COD is chosen) and returns if that order is cancelled; every change is logged | Apprentice (free) |
| **Your own restock reminders** | In-app nudges to reorder, per supplier, repeating | Apprentice (free) |
| **Finance** | Manual income/expense entries plus sales and purchases from orders; a monthly summary. Always shown with a "not accounting or tax software" notice | Apprentice (≤31-day summary) |
| **Reports** | Summaries up to 31 days (Free). Trends, best sellers, top customers, spending by supplier/category, any date range | Apprentice (31 days) / **Starter** (any range) / **Micro** (full reports) |
| **Follow-ups to customers** | Rules like "remind buyers of this product every 30 days" or per customer. In-app, at most one per customer per week, minimum interval 7 days, customers can stop reminders from any seller | **Neo** |
| **SMS Setup** | Visible to everyone; free members see a lock and a note that they need to subscribe | **Pro** |
| **Profit & loss, CSV / Excel / PDF exports** | By category over any period; real `.csv` (**Starter**), `.xlsx` (**Micro**) and `.pdf` (**Pro**) files; profit & loss needs **Pro** |

**Plans are the FLAME PH membership tiers** (see below). Billing is not connected yet; the tier-to-feature split lives in `lib/plans.ts` and is **enforced in the database** (`assert_tier(n)`, `_range_ok()`), so it can't be bypassed from the browser or by hitting `/export/*` directly.

**Reminders and SMS**
- A daily job (`/api/cron/reminders`, scheduled in `vercel.json` for 9:00 Manila time) runs `run_due_reminders()`: sends due in-app reminders and seller follow-ups. Set **`CRON_SECRET`** in Vercel (Vercel sends it as a bearer token). Admins can also press *Run reminders now* in **Admin → Plans**. The database function is callable only by the service role.
- Follow-ups skip customers who opted out of that seller, who already have an order in progress, or who got a follow-up in the last 7 days; and they stop when the seller's Pro lapses.
- **SMS is queued, not sent, until a provider is connected.** Pro sellers enable SMS (with a consent checkbox) at `/business/sms`; customers must **opt in** (off by default) under *Reminders → Allow restock SMS*, so nobody is texted without choosing it. Messages land in `sms_outbox` as `queued` (visible to sender and recipient). To go live, connect a provider (Semaphore, Twilio, Vonage…) by writing a small worker that sends `queued` rows and marks them `sent`/`failed`.

**Exports** are generated on the server from the signed-in user's own data (RLS applies). Text cells are neutralised against spreadsheet formula injection, CSV carries a BOM so Excel shows ₱ and Filipino characters correctly, and PDFs print amounts as "PHP" (the built-in PDF font has no peso sign).

## Phase 5: Growth & Integrations — how it works

**FLAME PH membership tiers** replace the old Free/Pro split. The fees come from the FLAME PH table; **the listing limits, affiliate-link quotas and tier→feature mapping are proposals** — change them in one place (`lib/plans.ts` + the `plan_tiers` seed rows / `assert_tier(n)` calls in `supabase/migrations`; a unit test checks the TS side).

| Tier | Fee (monthly / yearly) | Listings | Affiliate links | Adds |
|---|---|---|---|---|
| FLAME Apprentice (free) | ₱0 | 10 | 3 | Everything basic: customers, suppliers, inventory, own reminders, simple finance, 31-day summaries |
| FLAME Starter | ₱30 / ₱300 | 30 | 5 | Any date range, CSV export |
| FLAME Micro | ₱60 / ₱600 | 100 | 10 | Full reports, Excel export |
| FLAME Neo | ₱120 / ₱1,200 | 300 | 25 | Customer follow-ups, product feed, embeddable widget / button |
| FLAME Pro | ₱360 / ₱3,600 | 1,000 | 50 | SMS setup, profit & loss, PDF export |
| FLAME Champion | ₱720 / ₱7,700 | unlimited | 200 | Featured placement on the home page |

(₱7,700 is the yearly Champion price exactly as shown in the FLAME table; 12 × ₱720 would be ₱8,640. Confirm it is intended.)

- **Getting a tier:** members press *Request* on `/business/plan`; an admin grants it in **Admin → Plans**, or FLAME PH calls `POST /api/flame/membership` (`Authorization: Bearer $FLAME_SYNC_SECRET`, body `{ "email", "tier", "billing?", "period_end?" }`; `"tier": "apprentice"` ends a paid membership). The account is matched by email. Expired memberships fall back to Apprentice automatically. The sync function is service-role only.
- **Listing cap:** enforced by a database trigger for signed-in users; `/my/listings` shows the meter. Removed listings don't count.
- **Affiliate links:** a seller sets a commission (1–50%) per listing in *My listings*. Anyone signed in can ask to promote it (`/listing/…`); **the seller approves or declines every request** (`/business/affiliates`). Free members get **3** links, higher tiers more (links ended by either side free a slot). An approved link is `/r/<code>`: it records a click, stores a 30-day cookie, and an order placed from that browser is credited. The commission is *earned* when the order completes (rate × the item lines for that listing), *void* if cancelled, and the seller marks it *paid* after paying the affiliate **outside the platform**. Buyers can't credit themselves; sellers can't promote their own items.
- **Storefront links:** `/my/store` edits the logo, tagline, description, contact details, **Facebook Page and website** (http/https only); both show on the storefront.
- **Share & embed (Neo+):** `/business/share` gives a "Shop on MarketplacePH" button and product widget (`<script src="…/embed.js">`, no cookies) and the **product feed** at `/feed/<store-slug>?format=csv|json` (active listings only, no personal data; 403 for stores below Neo).
- **FLAME PH hooks:** `/flame` placeholder page (training, financing, mentoring, events — "coming soon"), the membership sync above, and Champion stores featured on the home page.
- **Trade Assurance:** design only — `lib/escrow.ts` (provider-agnostic interface), `TRADE_ASSURANCE_ENABLED=false`, and [docs/TRADE_ASSURANCE.md](docs/TRADE_ASSURANCE.md). It needs a licensed payment partner; nothing is live.

Demo accounts: `seller2@…` Pro, `seller3@…` Neo, `seller4@…` Champion, `buyer@…` Micro, `admin@…` Champion; `seller1@…` and the rest are Apprentice. The demo buyer has an approved affiliate link (`/r/demo2024`) and a pending request.

## Jobs marketplace (job seekers ⇄ employers and manpower agencies)

Free for everyone, under **/jobs** (a **Jobs** button in the header and bottom bar, and the right-hand hero on the home page).

- **Job seekers** make one profile (`/jobs/profile`): personal details, location, skills, education, work history, expected pay, and **documents** — 2x2 and half-body photos, resume, barangay / police / NBI clearance, transcript of records, certificates of employment, diploma, licences. Photos are shrunk on the phone; PDFs are accepted (max 5 MB each).
- **Employers and manpower agencies** post jobs (`/jobs/post`) with a description, qualifications, pay, deadline and the **documents they want attached**; agencies must show a licence/registration number and can mark "hiring for a client". They review applicants at `/jobs/employer`.
- **Applying** (`/jobs/<id>`): one tap with the profile; the seeker **chooses which documents to share per application**.
- **Privacy:** profiles and documents are never public. Only an employer the person applied to can see the profile, and only the documents ticked for that job. Files sit in a private bucket and are opened through 60-second signed links; **every employer open is logged** (`job_doc_access_logs`). Withdrawing an application removes the employer's access.
- **Anti-scam:** posts that ask for fees (placement, training, processing… also in Filipino) are rejected by the database; agencies need a licence number; at most 25 open posts per account; moderators can remove posts in **Admin → Jobs**.
- **Messaging:** employers and applicants can chat inside MarketplacePH (/jobs/messages), live, one thread per application; the chat closes if the application is withdrawn. Buyers and sellers chat at /messages (a Message store button is now also on every storefront), and both chats show an unread badge and send one notification per burst of messages.
- Not built yet: employers browsing a talent pool (only applicants are visible), job alerts, and overseas-recruitment verification (DMW/POEA).

Also new on the site: a dismissible **"under construction — sign up for updates"** bar above the header, and a **Real Estate & Properties** shop category (listing prices up to ₱5 billion).

## Deploying (Vercel + Supabase)

1. Create the hosted Supabase project, then `npx supabase link --project-ref <ref>` and `npx supabase db push` (**do not** run `seed.sql` against production).
2. Auth → enable Phone (with a real SMS provider such as Twilio/Semaphore/Vonage), Email, and Google. Remove `[auth.sms.test_otp]` for production. Set the Site URL and redirect URLs.
3. In Vercel set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only) `CRON_SECRET` (any long random string; protects the daily reminder job) and `FLAME_SYNC_SECRET` (24+ random characters shared with FLAME PH for membership sync).
4. Create the first admin by setting `profiles.role = 'admin'` for your user in the SQL editor.

## Known limitations (Phase 1)

- Phone OTP uses Supabase **test numbers** only; real SMS needs a provider.
- Chat is text-only (the private `chat-images` bucket and policies are ready).
- A "min rating" search filter is not built yet (ratings exist now; it needs an aggregated column or view).
- **Payment proofs are screenshots, so the platform still can't prove money moved.** Two colluding accounts could fake orders or deals. Mitigations today: a real chat or order flow is required, daily limits, public ranges only, and admin visibility. Pattern checks (same pair repeating, brand-new accounts, proofs reused across orders) are the next anti-fraud step.
- Verification documents are encrypted at rest by Supabase Storage (platform level); there is no extra application-layer encryption yet.
- Orders are not auto-completed if a buyer never confirms receipt (the daily job exists now and is the natural home for it, but it isn't wired); sellers can open a dispute meanwhile.
- Memberships are granted by hand (or synced by FLAME PH) until billing exists; there are no invoices, renewals or proration yet. SMS is queued only (see above). Restock reminders and follow-ups are in-app only today.
- Reports and finance count completed orders only and include shipping fees; "recorded deals" have no item detail, so they appear under their own line in category spending and not in best sellers.
- Dispute outcomes cannot be appealed yet (case flags can). Delivery addresses are kept with the order; a retention/purge job is not built yet.
- Notifications are in-app only; SMS/email delivery is not wired (Phase 3 spec lists them as optional).
- Packing proof is photos only (videos were deliberately left out for now).
- Expired watchlist entries are hidden automatically, but retained documents are purged by an admin button; there is no scheduled job yet (pg_cron or a Vercel cron is the follow-up).
- The service worker only caches brand assets and shows an offline page; it is registered in production builds only.
- Affiliate clicks are counted per visit (no bot filtering yet) and commissions are bookkeeping only: the platform doesn't move or verify payouts. A commission is credited when an order is placed from the affiliate cookie, so a buyer who uses two affiliates' links is credited to the last one.
- The embed widget and feed are public by design (they show only what's already public on the storefront). No rate limit on them yet beyond CDN caching.

Deployed automatically from GitHub to Vercel on every push to `main`.
