/** Badges people can request and admins (or the founder / webmaster) approve. Labels live in messages/*.json as badge.<key>. */
export const BADGES = ["verified_buyer", "good_applicant", "credible_employer", "years_verified"] as const;
export type BadgeKey = (typeof BADGES)[number];

export const FEATURED_KINDS = ["seller", "employer", "applicant", "buyer"] as const;
export type FeaturedKind = (typeof FEATURED_KINDS)[number];
