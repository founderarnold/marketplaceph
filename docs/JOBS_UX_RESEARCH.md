# Jobs UX research — what other job apps do and what MarketplacePH adopted

Date: 25 Nov 2026. Sources: general public knowledge of how these products work. **None of this was re-checked live
today (status "Recalled")**; features change often, so treat the comparison as a guide, not a spec.

## Patterns seen across job apps (Recalled)

| Pattern | JobStreet | Indeed | LinkedIn Jobs | Kalibrr | OnlineJobs.ph | Facebook-style groups/pages |
|---|---|---|---|---|---|---|
| Save / bookmark a job | ✓ | ✓ | ✓ | ✓ | ✓ | (save post) |
| Share a job (link, Messenger, Facebook) | ✓ | ✓ | ✓ | ✓ | partial | ✓ native |
| Company logo on every card | ✓ | ✓ | ✓ | ✓ | partial | page photo |
| "Urgently hiring" / "Actively hiring" badges | ✓ | ✓ | ✓ | partial | — | in post text |
| "Posted X days ago" freshness | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Similar / recommended jobs on a job page | ✓ | ✓ | ✓ | ✓ | — | — |
| Duplicate / repost a job (employer) | ✓ | ✓ | ✓ | ✓ | ✓ | copy-paste |
| Job templates by role (employer) | partial | ✓ | ✓ (AI draft) | partial | — | — |
| Close / filled status | ✓ | ✓ | ✓ | ✓ | ✓ | edit post |
| Deadline / expiry presets | ✓ | ✓ | ✓ | ✓ | — | — |
| Hiring poster / photo on the job | partial | — | — | ✓ | — | ✓ (image posts) |
| Job alerts / saved searches | ✓ | ✓ | ✓ | ✓ | ✓ | — |

## Adopted now (branch `feat/jobs-posting-tools`)

For employers, agencies and admins
- **Duplicate** a post into a hidden draft with the same owner, then just change the location, pay or dates and publish.
  Applications are never copied. (Admin list, employer dashboard, own job page.)
- **Hiring badges**: Urgent hiring, Few slots left, For wait list, Seasonal hire, and **Hired / filled**
  (one tap "Mark as hired / filled" also closes the post).
- **Company logo and job poster/photo** per post (public image storage only; falls back to the store logo).
- **Start from a template**: the 19 ready-made roles fill the title, description and qualifications.
- **Quick deadline** buttons: 7 / 14 / 30 / 60 days.

For job seekers
- **Save job** and a "Saved jobs" list on My applications.
- **Share** (phone share sheet, Facebook, Messenger, copy link with tracking tags).
- **Similar jobs** on every job page; **logos and badges** on job cards; **Urgent hiring** filter on /jobs.
- Already present before: posted X days ago, pay range, applicant counts for employers, saved searches (Jobs 2.0 P2).

## Recommended later (not built)
- Email / push job alerts from saved searches (needs a sending schedule and opt-in).
- "Easy apply" with one tap for complete profiles (Jobs 2.0 review screen already shortens this).
- Employer company pages listing all their open jobs.
- Salary insights per role and city (needs enough posts first).
- Bulk actions for agencies (close / repost many posts at once).
