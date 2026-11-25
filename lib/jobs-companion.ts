/**
 * Jobs applicant companion: the step-by-step guide for each application and when Follow-up / Re-Apply are allowed.
 * Pure functions (no database) so the same rules show in the page and are checked again in the server actions.
 * The database enforces Re-Apply on its own as well (reapply_to_job in 20261125000008).
 */
const DAY = 86_400_000;
/** Wait this long after applying (or after your last message) before a polite follow-up. */
export const FOLLOW_UP_DAYS = 3;
/** A not-selected application may be sent again after this many days. */
export const REAPPLY_AFTER_REJECT_DAYS = 14;
export const REAPPLY_GAP_DAYS = 7;
export const MAX_REAPPLY = 3;

const OPEN_STATUSES = ["submitted", "viewed", "shortlisted", "interview"] as const;

export type GuideApp = {
  status: string;
  created_at: string;
  updated_at: string;
  reapplied_at?: string | null;
  reapply_count?: number | null;
  applicant_confirmed_at?: string | null;
};
export type GuideStep = { key: string; state: "done" | "now" | "todo" };

/** Last time the applicant sent the application (first apply or the latest re-apply). */
const sentAt = (a: GuideApp) => new Date(a.reapplied_at ?? a.created_at).getTime();

/**
 * When the applicant may send a polite follow-up: FOLLOW_UP_DAYS after sending the application and after their own
 * last message. null = not possible for this status (withdrawn, not selected, hired).
 */
export function followUpFrom(a: GuideApp, lastOwnMessageAt: string | null): Date | null {
  if (!(OPEN_STATUSES as readonly string[]).includes(a.status)) return null;
  const base = Math.max(sentAt(a), lastOwnMessageAt ? new Date(lastOwnMessageAt).getTime() : 0);
  return new Date(base + FOLLOW_UP_DAYS * DAY);
}

/** Re-Apply: "ok", a date it becomes possible, or a reason it never will. Mirrors reapply_to_job(). */
export function reapplyState(a: GuideApp, postOpen: boolean, now = Date.now()): { ok: true } | { ok: false; from?: Date; reason: "status" | "closed" | "max" } {
  if (a.status !== "withdrawn" && a.status !== "rejected") return { ok: false, reason: "status" };
  if (!postOpen) return { ok: false, reason: "closed" };
  if ((a.reapply_count ?? 0) >= MAX_REAPPLY) return { ok: false, reason: "max" };
  const waits = [
    a.status === "rejected" ? new Date(a.updated_at).getTime() + REAPPLY_AFTER_REJECT_DAYS * DAY : 0,
    a.reapplied_at ? new Date(a.reapplied_at).getTime() + REAPPLY_GAP_DAYS * DAY : 0,
  ];
  const from = Math.max(...waits);
  return from > now ? { ok: false, from: new Date(from), reason: "status" } : { ok: true };
}

/**
 * The step-by-step guide for one application. Each step is done, the one to do now, or still to come.
 * Steps: profile -> sent -> follow up -> employer reviews -> interview -> result.
 */
export function applicationGuide(a: GuideApp, o: { hasResume: boolean; followedUp: boolean; now?: number }): GuideStep[] {
  const s = a.status;
  const rank = { submitted: 0, viewed: 1, shortlisted: 2, interview: 3, hired: 4, rejected: 4, withdrawn: -1 }[s] ?? 0;
  const steps: GuideStep[] = [
    { key: "profile", state: o.hasResume ? "done" : "now" },
    { key: "sent", state: s === "withdrawn" ? "todo" : "done" },
    { key: "follow", state: o.followedUp || rank >= 2 ? "done" : "todo" },
    { key: "review", state: rank >= 1 ? "done" : "todo" },
    { key: "interview", state: s === "interview" ? "now" : s === "hired" ? "done" : "todo" },
    { key: "result", state: s === "hired" ? (a.applicant_confirmed_at ? "done" : "now") : s === "rejected" ? "now" : "todo" },
  ];
  // The first unfinished step (after the profile tip) is the one to work on now.
  if (!steps.some((x) => x.state === "now" && x.key !== "profile")) {
    const next = steps.find((x) => x.key !== "profile" && x.state === "todo");
    if (next) next.state = "now";
  }
  return steps;
}
