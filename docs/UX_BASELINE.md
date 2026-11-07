# UX baseline findings (checked against the code, 7 Nov 2026)

Reported by the first site review, then checked in the repo. Several items were artifacts of the page-fetch tool, not real bugs.

| Reported issue | Result in code |
|---|---|
| Sponsored FLAME PH link doubles the domain | Not reproduced. `flame-ad-slot.tsx` uses an absolute `https://www.flameph.org/join`, `target=_blank`, `rel="sponsored noopener noreferrer"`. |
| "Sell" is plain text with no link | Not reproduced. It is the `SellMenu` button (dropdown). Needs JS, as do the other menus. |
| Email "Continue" button has no visible input | Not reproduced. The sign-in dialog is closed until opened; it has an email field. |
| Sign in and Create account lead to the same place | Confirmed for the `/login` page (no signup mode). The dialog already had both modes. Fixed in Step 2. |
| "Under construction" banner | It is a dismissible bar at the bottom of the page (not on the login screen). Left as is. |
| Header has too many items | Confirmed (about 12). Fixed in Step 4. |
| `/check` has two labels | Confirmed ("Check seller" vs "Check muna bago bayad"). Menus now use "Check seller"; the page title keeps the tagline. |
| Signed-in home is the same as the public home | Confirmed. Fixed in Step 5A (Business Home). |

Progress on `UX_IMPLEMENTATION_PROMPTS.md`:
- Done: 0, 1 (verified; label fix), 2, 3, 4, 5A, 6 (directory already had search, working "+N more", live tab counts; added a "Post what you need" button to the empty state), 7 and 8 (FAQ quick links and a Delivery riders section from facts in the code; open questions in `docs/FAQ_OPEN_QUESTIONS.md`), 9 (business menu in 4 groups), 10 (plans in 3 groups, upgrade button; billing wording was already honest).
- Also done: 5 (sponsor banner moved below the main content; "Buyers are looking for" hidden when empty), the Delivery "how it works" strip, the setup checklist on `/my/listings`, and a small Filipino wording pass for the menus (11).
- Not done: a full wording read-through of every page, and 12 (Lighthouse and browser walkthroughs), which need the app running on your computer (this environment only has the Windows build tools, so `next build` and `npm test` cannot run here).
