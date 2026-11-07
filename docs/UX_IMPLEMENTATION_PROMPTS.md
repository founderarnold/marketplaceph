# MarketplacePH UX Overhaul: Master Prompt and Step Prompts

How to use: paste the MASTER PROMPT once at the start of a Claude Code session in this repo. Then paste the STEP PROMPTS one at a time, in order. Do not start the next step until the previous one passes its checks and is committed.

---

## MASTER PROMPT

You are working on marketplaceph.com, the MSME marketplace of the FLAME PH ecosystem (Next.js + Supabase, EN/FIL).

**Goal:** make the site easier to understand and navigate for new visitors and for signed-in users at every level (buyer, seller, job seeker, employer, rider, and sellers on each FLAME tier from Apprentice to Champion), without breaking existing behaviour.

**Before anything else:**
1. Read `AGENTS.md`, `README.md` and the latest entries of `CHANGELOG.md`. Follow every rule in `AGENTS.md`, including any warnings about the Next.js version.
2. Read the files each step names before editing them.

**PROTECTED AUTH (never alter, remove or bypass):** the single FLAME PH account (one sign-in across FLAME PH sites via flameph.org) and the Google and Facebook sign-in/sign-up must keep working exactly as today. Do not edit these files: `app/auth/**`, `app/api/flame/**`, `lib/flame-sso.ts`, `lib/auth-providers.ts`, `lib/auth-errors.ts`, `app/actions/auth.ts`, `components/auth/facebook-button.tsx`, and the SSO logic in `proxy.ts`. In `components/auth/login-form.tsx` and `auth-modal.tsx` you may change layout, copy, ordering and the initial mode only; the handlers for Facebook, Google, phone OTP, email sign-in/sign-up, `done()`, `safeNext` and the `/auth/flame/push` redirect must stay byte-for-byte equivalent. After every step run `git diff main --stat -- app/auth app/api/flame lib/flame-sso.ts lib/auth-providers.ts lib/auth-errors.ts app/actions/auth.ts components/auth/facebook-button.tsx proxy.ts`. It must show no changes (or only the allowed layout edits you can justify). Also confirm that existing accounts still match by email, so no one gets a duplicate account.

**Rules for every step:**
- Make the smallest change that achieves the step. Reuse existing components, Tailwind tokens (`brand`, `accent`, etc.) and `lib/plans.ts`. Do not add dependencies.
- Every user-facing string goes through i18n. Add each new key to BOTH `messages/en.json` and `messages/fil.json` (the i18n completeness test fails otherwise). Use plain, friendly Filipino/Taglish consistent with existing copy. Do not mix English and Filipino within one label.
- Keep it mobile-first: 44px touch targets, no horizontal page scroll, keep the bottom nav working, keep accessibility (labels, aria, focus, contrast).
- Never change database rules, RLS, or tier enforcement. `lib/plans.ts` and the database must stay in agreement.
- Do not remove a route. If a link moves, keep the old URL working.
- After each step run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Fix failures before continuing. Report the exact results.
- Then view the changed pages in a browser at phone width (390px) and desktop (1280px), signed out and signed in, and tell me what you saw.
- Commit once per step with a clear message. Add a short entry to `CHANGELOG.md`.

**Working style:** Start each step by listing the files you will change and why. If something in the step conflicts with the code you find, stop and ask. Finish with a short summary: what changed, what you checked, anything left.

**Order of steps:** 0 Audit baseline, 1 Broken links and quick fixes, 2 Sign in and Create account split, 3 Role-based onboarding, 4 Header simplification, 5 Homepage (signed out), 5A Signed-in Business Home, 6 Categories, 7 FAQ and help, 8 Rider section, 9 Business dashboard grouping, 10 Plans page, 11 Wording and language consistency, 12 Final verification.

Confirm you have read the rules, then start with Step 0.

---

## STEP 0: Audit baseline

Read `components/layout/header.tsx`, `sell-menu.tsx`, `bottom-nav.tsx`, `mobile-menu.tsx`, `app/page.tsx`, `app/categories/page.tsx`, `components/listing/category-directory.tsx`, `app/faq/page.tsx`, `app/login/page.tsx`, `components/auth/auth-modal.tsx`, `components/auth/login-form.tsx`, `app/business/page.tsx`, `components/business/business-nav.tsx`, `components/business/setup-checklist.tsx`, `app/business/plan/page.tsx`, `lib/plans.ts`, `lib/seller-tools.ts`.

Do NOT change anything. Produce `docs/UX_BASELINE.md` with: (a) a map of every nav entry on desktop, mobile menu and bottom nav and where it goes, (b) every place the same destination has different labels (for example `/check`), (c) what a signed-out user, a new signed-in user with no store, and a seller with a store each see on the homepage and in the header, (d) the list of empty-state sections on the homepage, (e) each issue in Steps 1 to 11 below, marked "confirmed in code" or "not reproduced", with file and line. Take phone-width and desktop screenshots of home, login, categories, FAQ, sell hub and plans and save them in `docs/ux-baseline/`. Run the four checks and record the results.

## STEP 1: Broken links and quick fixes

Fix these, each only if Step 0 confirmed it:
1. The sponsored FLAME PH link doubles the domain (`marketplaceph.com/https://www.flameph.org/join`). Look in `components/ads/flame-ad-slot.tsx` and where it is used. External URLs must be absolute, open in a new tab with `rel="noopener noreferrer sponsored"`, and be clearly labelled "Sponsored".
2. A raw path such as `/search?category=agriculture-farm-fisheries` showing as link text. Replace with the translated category name.
3. Header greeting text running together (for example "Hello, welcomeSign in"). Add spacing/structure so screen readers and sighted users read "Hello, welcome" then "Sign in".
4. The nav item "Sell" appearing as plain text with no link in non-JS output. Make the Sell button a real link to `/sell` that the dropdown enhances.
5. One label for the seller check destination. Use "Check seller" everywhere in English and a single matching Filipino label; keep "Check muna bago bayad" only as a tagline on the `/check` page.
Add tests for 1 and 5 if a pattern exists in `tests/`.

## STEP 2: Split Sign in and Create account

Today both go to the same login page. Change it so:
1. `/login` has two clear modes, "Log in" and "Create account", chosen by a visible toggle or tabs, and `?mode=signup` opens signup directly. The header's Create account button and the Sell hub's signup button use signup mode.
2. Signup mode shows three short reasons to join (post for free, check sellers before paying, free job board), then the sign-in options: Continue with Facebook, Continue with Google, and "Use email instead". The email fields appear only after tapping "Use email instead". Log in mode shows the same options plus password and "Forgot password?". Keep the existing phone OTP flow if it exists in the code.
3. Remove the "We're still under construction" banner from the login and signup screens only. Keep it elsewhere if you need it, but make it dismissible (remember dismissal in localStorage inside try/catch) and not shown on checkout, orders or messages.
4. Preserve `?next=` redirects and the open-redirect protection. Keep the Data Privacy Act consent text visible.
Apply the same changes to the modal in `auth-modal.tsx` so the page and modal match. Add tests for the redirect safety if affected.

## STEP 3: Role-based onboarding

After a brand-new user's first sign-in (no store, no job profile, no rider registration), show one screen "What brings you here?" with four large cards: Buy things, Sell my products or services, Find or post jobs, Deliver as a rider. Each card goes to the right first step: `/search` or `/looking-for/new`, the 3-field store setup at `/sell/new`, `/jobs` or `/jobs/profile`, `/delivery/register`. Include "Skip for now".
- Save the choice in the user's profile only if a suitable column exists. If it would need a migration, store it per-device in localStorage instead and note this in the changelog; do not add a migration without asking me.
- Never show the screen again after a choice or skip.
- Sellers: after the store exists, keep the `SetupChecklist` on `/business` and also show a slim version (current step plus a "Next" button) at the top of `/my/listings`.
- Add a one-time hint pointing at Check seller for first-time buyers on their first listing page visit.

## STEP 4: Simplify the header and menus

In `components/layout/header.tsx`, `mobile-menu.tsx` and `bottom-nav.tsx`:
1. Reduce the browse bar to at most 6 items: All categories (Browse), Buy, Sell (existing dropdown), Jobs, Delivery, Check seller. Keep the orange "Post for FREE" button.
2. Move Ready stock, Find Suppliers, Find Services, Negosyo and Looking for into a "Buy" or "Browse" dropdown, built like `SellMenu` (keyboard accessible, Escape closes, fixed positioning for the scrollable bar). Group them: "Shop", "Find suppliers", "Find services", "Negosyo opportunities", "Buyer requests".
3. Rename "Looking for" to "Buyer requests" and add a one-line description in the dropdown. Rename "Updates" to something self-explanatory (check what `/updates` actually shows and name it accordingly, for example "Community news"); if it is minor, move it into the footer.
4. The mobile menu must show the same grouping, with the current user's role-relevant items first (sellers see Sell tools first, job seekers see Jobs first).
5. Keep the footer columns as they are, but make sure no destination disappears from the site.
6. Make the sticky header height not grow on mobile. Verify the bottom nav still highlights the right tab.

## STEP 5: Homepage

In `app/page.tsx` and `components/home/*`:
1. First screen: one headline, a visible search box, and three role cards (Buy, Sell, Find jobs), each with one button. Remove duplicated CTAs further down the page.
2. Make the sponsored FLAME PH banner smaller and place it below the main content block, labelled "Sponsored".
3. Hide any section that has no content (for example "Buyers are looking for" with no requests, or a latest-listings row with fewer than 4 items). Where hiding leaves the page thin, show a single friendly call to action instead ("Be the first to post. It's free").
4. Show real trust numbers only when they are true and above a minimum (for example verified stores, listings), taken from the database, never hard-coded.
5. Add a short "How it works" strip with 3 steps for buyers and a link to the FAQ, and a "Check before you pay" card linking to `/check`.
6. Signed-in users get the separate Business Home built in Step 5A. In this step, only make sure `/` renders the signed-out homepage for visitors and leaves a clean switch point for 5A.
Check Lighthouse mobile performance does not drop more than 3 points.

## STEP 5A: Signed-in Business Home (Facebook-style familiar layout for business owners)

Goal: when a user is signed in, `/` becomes a personal "Business Home": a familiar social-feed layout (left shortcuts, center feed, right panel) designed for MSME owners, sellers, suppliers, manufacturers, professionals and service providers to run their day. Signed-out visitors keep the Step 5 homepage. Do not copy Facebook branding, icons or wording; borrow only the familiar layout pattern.

First read `app/page.tsx`, `app/updates/page.tsx`, `app/looking-for/page.tsx`, `app/jobs/page.tsx`, `app/actions/social.ts`, `app/actions/engage.ts`, `components/social/*`, `components/listing/listing-card.tsx`, `components/requests/request-card.tsx`, `components/jobs/job-card.tsx`, `app/business/page.tsx`, `components/business/setup-checklist.tsx`, `components/layout/account-menu.tsx`, `lib/plans.ts` and `lib/seller-tools.ts`. Reuse their queries and cards. Do NOT add database tables, columns or migrations without asking me first. If a feature below needs one, build the version that works with existing data and list the gap in `docs/BUSINESS_HOME_OPEN_QUESTIONS.md`.

**Layout (desktop, 1280px):**
1. **Left rail (shortcuts, sticky):** my profile/store card (logo, name, verification badge, FLAME tier chip), then shortcut links with icons and unread counts: Messages, Orders, My listings, Buyer requests, Customers, Inventory, Finance, Jobs, Delivery, Favorites, Check seller, Plans. Show only shortcuts relevant to the user's role (see Personalization). A "See more" expands the rest of the Sell tools. Locked paid tools show the tier chip, never hidden.
2. **Center feed:**
   - **Composer card** at the top, like "What's on your mind?": avatar plus the prompt "What do you want to post today?" with four quick buttons: Post a product or service (`/sell/new`), Post what I need (`/looking-for/new`), Post a job (`/jobs/post`), Share an update (the existing update feature, or a link to `/updates` if none). Tapping opens the existing forms; do not rebuild them.
   - **Quick actions strip** for day-to-day work, horizontally scrollable on phones: Add listing, Update stock, Reply to messages, Record sale/expense (`/business/finance`), New customer note, Book a rider, Check a seller.
   - **Filter chips** above the feed: All, Products, Services, Suppliers, Buyer requests, Jobs, Updates, From stores I follow. The selected chip is kept in the URL (`?feed=`).
   - **Feed cards** (one consistent card design, each with a clear type label, the poster's name and badge, time, location, and actions Message, Save, Share, Check seller): new listings, buyer requests that match my categories or region, updates from stores I saved, new jobs, supplier and manufacturer posts. Newest first with a light relevance boost for my categories and region; no hidden or opaque ranking. Use "Load more" pagination, not infinite scroll.
3. **Right rail (sticky):** "Today" panel (new orders waiting, unread messages, low stock, reminders due, buyer requests matching my products), the Setup checklist if incomplete, "Suggested for you" (verified suppliers/buyers in my categories or region), one small labelled Sponsored FLAME PH slot, and a "Get verified" or upgrade nudge only when relevant.

**Mobile (390px):** a single column. Order: compact greeting, Today summary (3 to 4 numbers), composer card, quick actions strip, filter chips, feed. The left rail becomes the existing mobile menu and bottom nav; the right rail content is folded into the Today summary and a "Suggested" card inside the feed. Nothing may need horizontal page scroll. Touch targets at least 44px.

**Personalization by account type** (use existing store seller type, role and activity; ask me if a field is missing):
- **Seller, retailer, reseller:** Today = orders, stock, messages; feed prioritizes buyer requests matching their products.
- **Supplier, manufacturer, distributor, importer:** feed prioritizes requests from resellers and retailers and wholesale/MOQ posts; shortcut to wholesale tiers and Find Suppliers visibility.
- **Service provider and professional expert:** feed prioritizes service requests; shortcut to services listings, inquiries and ratings; no stock widgets.
- **Buyer only (no store):** feed prioritizes new listings, ready stock and suppliers near them; a gentle "Start selling for free" card; Check seller prominent.
- **Job seeker / employer / rider:** show their application, hiring or booking status at the top of Today, with a link to the Jobs or Delivery area.
- **Tier-aware:** free-tier users see what upgrading unlocks inside the relevant card (inline, dismissible); paid users never see upgrade nudges for features they already have.

**Day-one and empty states:** a brand-new account gets the role-based onboarding card (Step 3) and the setup checklist at the top; empty feed sections show a useful call to action instead of blank space ("No requests match yet. Post your products so buyers can find you.").

**Rules for this step:**
- Reuse existing server actions and cards; keep all reads respecting RLS. Never show private data (customer details, finances, documents) in the feed or to other users.
- Do not make likes/comments/reactions or follow-graph features that need new tables. Save, Message, Share and Check seller are enough. Anything more goes in `docs/BUSINESS_HOME_OPEN_QUESTIONS.md`.
- Performance: render the Today panel and the feed in separate `Suspense` boundaries with skeletons so the page shell appears fast; keep Lighthouse mobile performance within 3 points of baseline.
- Accessibility: landmarks for each rail and the feed, keyboard-reachable composer and chips, visible focus, `aria-live` not used for the feed, contrast at least AA.
- i18n: all strings in both `messages/en.json` and `messages/fil.json`.
- The signed-out homepage and all existing routes must be unchanged.
- Add tests for: signed-out users do not see Business Home, feed filters read from `?feed=`, and the private data stays out of the feed query.

Check: log in as (a) a new account with no store, (b) a seller on the free tier, (c) a paid-tier supplier or manufacturer, (d) a service provider, (e) a job seeker. Screenshot each at 390px and 1280px and save to `docs/ux-business-home/`. Report what each role sees first.

## STEP 6: Categories page

In `app/categories/page.tsx` and `components/listing/category-directory.tsx`:
1. Show the 8 to 10 most popular categories first as large tiles, with "Show all categories" expanding the rest. Keep each category's sub-categories collapsed until tapped.
2. Verify the tab counts (All, Shop Products, Find Suppliers, Find Services, Negosyo Opportunities) match the categories actually in each tab. Fix mismatches in data or code, and show the real count.
3. Make "+N more" a working control that expands inline.
4. Add a proper empty state for any category or search with no results: a message, a "Post what you need" button to `/looking-for/new`, and suggested nearby categories.
5. Add a search box on this page that filters categories by name.

## STEP 7: FAQ and help

In `app/faq/page.tsx` (and the messages files):
1. Add an "In short" box at the top with the five questions new users ask most: Is it free? How do I buy safely? How do I sell? How do I check a seller? How do I get verified?
2. Add the missing answers, using only facts that exist in the code or policy docs (`docs/TRADE_ASSURANCE.md`, `lib/plans.ts`). Cover: fees and commission (say clearly what is free and what the FLAME tiers cost), refunds and returns as the platform actually handles them, dispute steps and response windows from the case workflow, how each badge is earned and what it means (Verified buyer, Verified seller, Credible employer, verified rider), and what happens if a seller stops responding.
3. If a fact is not defined anywhere, DO NOT invent it. List it in `docs/FAQ_OPEN_QUESTIONS.md` for me to answer, and leave a clearly marked placeholder out of the live page.
4. Add anchors per audience (`#buying`, `#selling`, `#jobs`, `#riders`, `#safety`) and a sticky mini-index on mobile. Link contextually: listing page to buying safely, sell hub to `#selling`, delivery to `#riders`.

## STEP 8: Rider section

1. Add a Delivery riders section to the FAQ: how to book a rider, how a rider registers, requirements, how verification works, how fees/payment work, and what to do in a dispute. Same rule as Step 7: only facts that exist in the code, otherwise add to `docs/FAQ_OPEN_QUESTIONS.md`.
2. On `/delivery`, add a short "How it works" for customers and for riders, with two buttons (Book a rider, Register as a rider).
3. On `/delivery/register`, show the requirements and what happens after submitting before the form starts.
4. Link riders from the order and checkout flow where delivery is chosen.

## STEP 9: Business dashboard navigation

In `components/business/business-nav.tsx` and `app/business/page.tsx`:
1. Replace the 12-tab sideways-scrolling row with 4 groups: Sales (Overview, Customers, Reports), Stock (Inventory, Suppliers, Reminders), Money (Finance, Staff), Grow (Affiliates, Share, SMS, Plan). Use a compact top group switcher with the active group's items below it. On phones it must not need horizontal scrolling for the groups.
2. Mark paid features with the same tier chip and lock icon style used in `SellMenu`, using `FEATURE_MIN_RANK`. Locked items stay visible and open an explanation of what they do and which tier unlocks them (with a link to Plans), not an error.
3. On `/business`, show a "Today" panel: orders waiting, low stock, reminders due, then the setup checklist if incomplete.
4. Keep every route and the `aria-current` behaviour.

## STEP 10: Plans page

In `app/business/plan/page.tsx` and `app/sell/page.tsx`:
1. Lead with three groups: "Start free" (Apprentice), "Grow" (Starter, Micro), "Run a business" (Neo, Pro, Champion). The six tiers and prices stay, shown beneath each group. Show monthly and yearly toggle with the yearly saving.
2. Add a comparison table with the features added at each tier using `featuresAddedAt()`, with plain-language descriptions, and highlight the signed-in user's current tier.
3. Where a user hits a tier limit (listing limit, affiliate links, locked tools), show an inline "Upgrade to Starter (₱30/mo)" prompt at that moment using `isProError`, instead of a raw error.
4. Be honest about billing status: if billing is not connected, say how to upgrade (the real current process) rather than showing a Pay button that does nothing.
5. Do not change prices, limits or enforcement.

## STEP 11: Wording and language consistency

1. Search `messages/en.json` and `messages/fil.json` for mixed English/Filipino labels inside the same menu or button and make each language consistent. Keep brand words that people actually use (Negosyo) but add a short helper line where meaning could be unclear.
2. Check every new string exists in both files and read through the Filipino for natural tone.
3. Make sure empty states, errors and buttons say what to do next.
4. Run the i18n completeness test.

## STEP 12: Final verification

1. Run typecheck, lint, tests, build and Lighthouse (mobile) on Home, Search, Listing, Login, Categories, Sell hub, Plans. Compare with the baseline. Nothing may drop by more than 3 points; accessibility must stay at 95+.
2. Walk through these journeys in a browser at phone width and desktop, signed out then signed in, and write what you found in `docs/UX_FINAL_CHECK.md` with screenshots:
   - New visitor: understand the site, search, open a listing, check a seller.
   - New buyer: create an account, post a buyer request, message a seller.
   - New seller: create an account, set up the store, post the first listing, finish the checklist.
   - Seller on a paid tier and on the free tier: find a locked tool and understand how to unlock it.
   - Signed-in Business Home for a new account, a free-tier seller, a paid supplier/manufacturer and a service provider: composer, quick actions, feed filters, Today panel, mobile layout.
   - Job seeker: create a profile and apply. Employer: post a job.
   - Rider: read requirements and register.
3. List anything unresolved, plus the items in `docs/FAQ_OPEN_QUESTIONS.md` that I need to answer.
4. Update `CHANGELOG.md` and give me a short summary.

---

## Notes for the owner
- Run the steps in order; each is a separate commit, so any one can be reverted.
- Steps 7 and 8 need your answers about fees, refunds, dispute timelines, badge rules and rider requirements. Claude Code will list unknowns in `docs/FAQ_OPEN_QUESTIONS.md` rather than guess.
- Step 5A reuses existing data only. Likes, comments, follow graphs and similar social features would need new tables; Claude Code will list them in `docs/BUSINESS_HOME_OPEN_QUESTIONS.md` for your decision.
- Step 3 may need a database column to remember the chosen role. The prompt tells Claude Code to ask before adding a migration.
