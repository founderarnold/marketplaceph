# Changelog

## [Unreleased] — Jobs marketplace, announcement bar, real estate

### Added
- **Jobs marketplace** (`/jobs`): seeker profiles with private documents (2x2, half-body, resume, barangay/police/NBI clearance, transcript, certificates), job posts from employers and licensed manpower agencies, applications with per-job document sharing, hiring statuses (shortlist, interview, hired, not selected), employer dashboard, "my applications" with withdraw, notifications, Admin → Jobs moderation, English and Filipino.
- **Privacy and safety:** documents in a private bucket, signed links, every employer open logged; no-fee guard on posts; agency licence required.
- **Home page:** two hero panes — business marketplace (original hero kept) on the left, jobs for seekers and employers on the right; **Jobs** button in the header and bottom navigation.
- **Announcement bar** above the header: the site is under construction, sign up for updates (dismissible).
- **Real Estate & Properties** shop category; listing price cap raised to ₱5 billion.
- **Database:** migration `20261013000001_jobs_and_real_estate.sql`.
- **Tests:** 121 total (11 new).

## [Unreleased] — Phase 5: Growth & Integrations

### Added
- **FLAME PH membership tiers** (Apprentice free, Starter ₱30, Micro ₱60, Neo ₱120, Pro ₱360, Champion ₱720 per month; yearly fees as in the FLAME table) replace the binary Free/Pro plan. Basic features stay free; advanced ones unlock by tier, enforced in the database (`assert_tier`). Plan page shows all tiers, usage meters and a request form; Admin → Plans grants any tier; locked features name the tier that unlocks them.
- **Listing caps per tier** (Apprentice: 10 posts) with a database trigger and a usage meter on *My listings*.
- **Affiliate links:** free for everyone, limited to **3** (more by tier). Sellers set a commission per listing and **approve every affiliate**; trackable links (`/r/<code>`, 30-day cookie), click/order/commission dashboard, commission lifecycle (pending → earned → paid / void), payouts outside the platform, notifications.
- **Store profile editor** (`/my/store`): logo, tagline, description, contact, Facebook Page and website links (shown on the storefront).
- **Share & embed (Neo+):** "Shop on MarketplacePH" button, product widget (`/embed.js`), product feed CSV/JSON (`/feed/<slug>`).
- **FLAME PH hooks:** `/flame` page, `POST /api/flame/membership` (shared secret, service-only `sync_membership`), Champion "Featured" stores on the home page and storefront.
- **Trade Assurance (design only):** `lib/escrow.ts` interface behind `TRADE_ASSURANCE_ENABLED`, plus `docs/TRADE_ASSURANCE.md`. No live escrow.
- **Database:** migration `20261012000001_growth_and_affiliates.sql`; the Phase 4 migration was edited in place for tiers (nothing had been deployed).
- **Tests:** 110 total (12 new): tier gating at every level, FLAME sync, listing cap, affiliate approval/quota/commission/payout/void/revoke, featured stores, link validation, plus unit tests for the tier config.

### Notes
- The ₱7,700 yearly price for Champion is implemented as written in the FLAME table (12 × ₱720 = ₱8,640).
- Listing limits, affiliate quotas (3/5/10/25/50/200) and the tier→feature mapping are proposals; edit `lib/plans.ts` and the matching migration values to change them.
- Billing is still manual.

## [Unreleased] — Phase 4: Business Tools

### Added
- **Free vs Pro plans:** one config (`lib/plans.ts`) for the split, enforced in the database. Free users see a "This is a Pro feature. Subscribe to enable it." note wherever something is locked. Subscriptions are granted by admins (Admin → Plans) because no payment provider is connected yet; users can request an upgrade at `/business/plan`; every change is audit-logged.
- **SMS Setup button** (visible to everyone, locked for Free with "SMS reminders are a Pro feature. You need to subscribe to enable them."). Pro sellers set it up with a consent checkbox. Messages are **queued** (`sms_outbox`), not sent, until an SMS provider is connected. Customers must opt in (off by default).
- **Seller CRM:** customer list built from orders (totals, history, last phone, private notes and tags, tag filter, link to chat and buyer sheet).
- **Buyer supplier database:** automatic supplier list with spend, favourites, notes/tags and one-tap reorder.
- **Reminders:** your own in-app restock reminders (Free); automatic follow-ups to customers per customer or per product (Pro; min every 7 days, one per customer per week, skips opt-outs and customers with an open order); customers can stop reminders from any seller; daily job at `/api/cron/reminders` (Vercel Cron) plus a "Run now" button for admins.
- **Reports:** sales and spending summaries (Free, up to 31 days); trends, best sellers, top customers, spending by supplier/category and any date range (Pro).
- **Finance:** income and expense entries with a monthly summary (Free); profit & loss by category over any period (Pro); disclaimer that it isn't accounting or tax software.
- **Exports (Pro):** CSV, Excel and PDF for sales, customers, purchases and profit & loss; formula-injection-safe; produced from the user's own data only.
- **Inventory (Free):** stock counts with an audit trail, per-listing low-stock alerts, notifications when stock crosses the threshold, automatic "Out of stock" at 0; stock now drops when payment is confirmed (or COD) and is restored if the order is cancelled.
- **/business hub** with a to-do banner, this-month numbers and navigation; Business link in the header and account page; notification texts for reminders, low stock and plan activation (English and Filipino).
- **Database:** migration `20261011000001_business_tools.sql` adds subscriptions, plan_requests, crm_customers, supplier_notes, restock_reminders, follow_up_rules/log, reminder_optouts, sms_settings/outbox, inventory_adjustments, income_entries, expenses and the reporting, finance and reminder functions; RLS on all of it.
- **Tests:** 22 new tests (98 total): Free/Pro gating of every advanced function, plan grants/expiry/revocation, CRM and supplier privacy, report numbers checked against the seed, finance maths and privacy, stock moving on payment/cancel/low-stock/zero, reminder runner (service-role only, opt-outs, weekly cap, open-order skip, lapsed Pro), SMS queued only with both consents, plus unit tests for CSV injection, date ranges and real Excel/PDF generation.

### Verified
- typecheck, lint, 98/98 tests (also on a fresh database reset), production build.
- Browser walkthrough as a Free user (locked SMS Setup with the subscribe note; long reports, P&L and follow-ups locked; export URLs return 403) and as a Pro user (reports, 12 export files across CSV/Excel/PDF verified by type, filename and content, stock count with low-stock alert, SMS setup with consent).

### Known gaps / next
- Billing/payments for Pro; an SMS provider worker; follow-ups by SMS are queued only.
- Auto-completing unconfirmed deliveries via the new daily job; retention purge for delivery addresses; dispute appeals.

## Phase 3: Orders & Transactions

### Added
- **Cart and order requests:** add to cart (MOQ and wholesale tiers applied), grouped by seller; checkout with delivery details, urgency and an optional preferred courier; one request per seller.
- **Order lifecycle (all enforced in the database):** requested → quoted → payment submitted → paid → packed → shipped → delivered → completed (or cancelled / disputed). Seller quotes the final price per item plus shipping (valid 1–14 days); buyer pays the seller directly and uploads a screenshot and reference number, or chooses COD; seller confirms or rejects the payment; packing needs a ticked checklist and 1–6 server-timestamped photos; buyer confirms receipt; reviews follow.
- **Shipping methods configurable by sellers and buyers:** built-in list (Lalamove, Grab Express, Transportify, Borzo, J&T, LBC, Ninja Van, Flash, JRS, 2GO, SPX, trucking, bus cargo, van/jeep, pickup); sellers choose supported methods per store and per listing; anyone can add up to 25 of their own couriers/truckers/bus lines, private until named on an order.
- **Shipment details:** tracking number, booking link, driver and plate, and bus fields (line, plate, from/to terminal, ETA, waybill photo).
- **Rule-based shipping recommendation** by distance, size/weight and urgency (island-aware: no buses or vans across the sea), shown live at checkout.
- **One-tap reorder** at current prices/stock, with a clear note about anything skipped or adjusted.
- **Disputes:** opened by either side with evidence, 3-day response window, admin-only resolution with a note both sides read; resolved outcomes drive the seller's dispute rate; admin mediation tab with logged file access.
- **Trust metrics updated:** dispute rate from resolved disputes lost; buyer payment reliability from confirmed vs rejected payment proofs; buyer cancellation rate now counts only walking away after a quote or payment.
- **Order, cart and shipping UI:** cart, checkout, order pages with timeline per role ("your turn" hints in the list), `/my/shipping` for shipping methods and payment accounts, cart icon and notification texts for every step (English and Filipino).
- **Database:** migrations `20261010000001/2` add order lifecycle states, order_items, order_delivery, cart_items, payment_proofs, packing_proofs, shipments, disputes, dispute_evidence, shipping_methods (+ store/listing links), store_payment_methods, a private `order-files` bucket, and the workflow functions; RLS on all of it.
- **Tests:** 25 new tests (76 total): full lifecycle with a guard at every step, direct-edit blocking, quote validation and expiry, COD rules, payment rejection and reliability, cancellation rules, custom-method visibility, payment-account privacy, dispute window and outcomes with their effect on metrics, plus unit tests for the shipping rules and tier pricing.

### Fixed along the way
- Two bugs caught by the new tests before release: a row-level-security recursion on the seller's shipping settings, and a missing-result check when resolving a "partial" dispute.
- PWA icons compressed from ~750 KB to ~170 KB.

### Verified
- typecheck, lint, 76/76 tests (also on a fresh database reset), production build.
- Browser walkthrough: quote (₱31,800 total checked by hand), photo-proofed packing, bus shipment with terminals/plate/tracking, payment with uploaded proof, receipt confirmation, reorder into the cart, checkout with live shipping suggestions, a new order request with a preferred courier, a buyer's custom courier.
- Lighthouse (mobile emulation, local production build, a busy laptop): search 88, storefront 86, home/listing 78–89 across repeated runs (92–93 in Phase 2 on a quieter machine); CLS 0, accessibility 96–100. Signed-out page weight did not grow in this phase, so treat the dip as measurement noise and re-measure after deploying.

### Known gaps / next (Phase 4)
- Seller CRM, supplier database, restock reminders, reports, finance and inventory (stock is not yet decremented on orders).
- Auto-complete for unconfirmed deliveries, delivery-address retention purge, dispute appeals, SMS/email notifications, anti-collusion pattern checks.

## Phase 2: Trust Layer

### Added
- **Seller verification:** Phone → ID → Business levels; document upload to a private bucket that nobody can read through the API; admin review queue; signed 60-second URLs with a log row for every open; retention dates and purge; notifications to the owner.
- **Deals and two-way reviews:** the seller records a deal from a chat, the buyer confirms, then each side can leave one review (rating, comment, up to 4 photos). 60-day review window; reviews are public and not editable; admin deletion is audit-logged.
- **Trust metrics (computed in SQL):** completed deals, total sold as a range, items sold, average rating, response rate (24h, last 90 days), dispute rate, member since. Buyer metrics: completed deals, ordered range, cancellation rate, ratings.
- **Badges:** Fast Responder, Top Seller and Reliable Buyer (derived live), plus seller type, verification level and years-in-business badges.
- **Reports → cases → watchlist with due process:** notice and response window, private evidence (shared with the reported user only at an admin's choice), decisions (dismissed, warning, temporary restriction, flagged after review), 30-day appeal with a different-admin rule, restrictions enforced on posting, chat and deals, neutral public wording, expiry and review dates.
- **"Check muna bago bayad" (`/check`):** exact-match lookup by phone, GCash name or store; no enumeration; no allegation details; "no flag does not mean safe" messaging. Flag banner on store and listing pages.
- **Information sheets:** printable seller sheet and buyer sheet (buyer opt-in), with share and print actions.
- **Notifications:** bell with unread count and a notifications page.
- **Admin:** Cases, Appeals, Verification and Watchlist tabs; document access log; database rule messages shown on failure (for example "response window is still open").
- **Database:** migrations `20261009000001/2` add orders, reviews, store_verifications, verification_documents, document_access_logs, report_evidence, report_responses, watchlist_entries, appeals, notifications and badges; SECURITY DEFINER workflow functions with explicit checks; RLS on all new tables; private storage buckets.
- **Tests:** 14 new integration tests (51 total): metric math and range buckets, badge rules, buyer-sheet privacy, deal state machine and review eligibility, verification document privacy, the full case workflow (cannot skip notice, window enforced, flag neutrality, appeal and revocation, restrictions, moderators cannot publish flags) and check-before-pay matching.

### Verified
- typecheck, lint, 51/51 tests (also on a fresh database reset) and the production build all pass.
- Browser walkthrough: deal proposed → confirmed → reviewed (store went from 24 to 25 deals), verification upload (private files, pending request), admin opening a document (log row written), `/check`, storefront trust card.
- Lighthouse (mobile emulation, local production build): /check 95, /search 90, storefront 85, information sheet 90; CLS ≈ 0; accessibility 96–100.

### Known gaps / next
- Phase 3: full orders (payment proof, packing proof, shipping), disputes feeding the dispute rate, payment-reliability metric, stronger fake-deal detection, scheduled purge and expiry jobs.

## Phase 1: Core Marketplace

### Added
- **Auth:** mobile number + OTP (primary), email + password, Google OAuth wiring; profile auto-created on signup; open-redirect-safe `?next=`.
- **Sellers:** 3-field store setup (name, seller type, location), declared seller type (Manufacturer, Direct Importer, Distributor/Supplier, Reseller, Retailer, Service Provider), years-in-business badge, verification level shown everywhere a store appears.
- **Listings:** products and services; multiple photos with on-device compression + thumbnails; fixed / range / "message for price"; unit, MOQ, wholesale tiers; stock status (In stock / Made to order / Pre-order / Out of stock) with quantity on hand and automatic "Out of stock" at 0; region → province → city location; seller dashboard to edit stock, hide/show, delete.
- **Discovery:** keyword search; filters for category, region/province/city, price range, seller type, verified-only, in-stock-only; sort; pagination; storefront pages (in-stock vs out-of-stock sections); share button + Open Graph/Twitter metadata for listings and stores (served in `<head>` for all crawlers incl. Viber).
- **Messaging:** realtime buyer ↔ seller chat with the listing attached, inbox with unread counts, read receipts.
- **Favorites:** saved listings and saved sellers.
- **Reports:** private report intake on listings and stores (no public labels in Phase 1).
- **Admin panel:** reports triage, listing takedowns, store verification level, user roles, categories, banned keywords, audit log.
- **Account:** edit profile, language preference, **data export (JSON)**, **account deletion**.
- **Platform:** English/Filipino UI with toggle; installable PWA (manifest, icons, offline page); mobile-first layout with bottom navigation; brand theme from the logo.
- **Database:** 15 tables + 1 view, RLS on every table, storage buckets (`listing-images`, `store-assets`, `chat-images`, `private-docs`), realtime on `messages`, DB-level rate limits, banned-keyword guard, audit triggers, generated TypeScript types.
- **Seed data:** 9 sample Philippine stores, 27 listings, categories, banned keywords, starter PSGC subset, demo accounts.
- **Tests:** 37 tests — formatting/search/phone/redirect units, i18n completeness (every key exists in both languages), and RLS/permission integration tests (anon, chat privacy, seller isolation, self-verification and self-promotion blocked, banned items, inventory rule, takedown + audit).

### Verified
- `npm run typecheck`, `npm run lint`, `npm test` (37/37), `next build` all pass.
- Lighthouse (mobile emulation, production build against local Supabase): performance Home 92, Search 93–96, Listing 93, Login 93 (target 85+); CLS 0; accessibility 96–100; best-practices 100; SEO 100. Real-network numbers on Vercel will differ; re-measure after deploy.
- Manually exercised in a browser: phone-OTP login, store setup, photo upload (969 KB → 245 KB), posting a listing, chat with realtime delivery, language toggle, admin tabs.

### Known gaps / next
- Still open from Phase 1: full PSGC import, image-moderation provider, chat image attachments.
- Phase 3 — Orders: cart/order request, payment proof, packing proof, shipping methods + recommendations, reorder, disputes. Order-flow tests land with it.
