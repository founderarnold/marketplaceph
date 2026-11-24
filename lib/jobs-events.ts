/** Jobs 2.0 funnel events (P2 adds the landing ones; P7 extends the list). Names and props are allow-listed; no PII. */
export const JOB_EVENTS = ["jobs_landing_view", "job_search", "job_view", "signup_start", "referral_attribution", "profile_step_complete", "resume_generated"] as const;
export type JobEvent = (typeof JOB_EVENTS)[number];

/** Result counts are bucketed so an event never reveals an exact, possibly identifying, number. */
export function countBucket(n: number): "0" | "1-5" | "6-20" | "21+" {
  return n <= 0 ? "0" : n <= 5 ? "1-5" : n <= 20 ? "6-20" : "21+";
}

export type JobEventProps = {
  has_q?: boolean;
  has_loc?: boolean;
  category?: string;
  results?: ReturnType<typeof countBucket>;
  job_id?: string;
  source?: string;
};
