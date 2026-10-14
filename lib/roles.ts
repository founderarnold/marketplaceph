/** Staff roles. Founder and webmaster have the same powers as admin; moderators handle reports and verification. */
export const FULL_ADMIN_ROLES = ["admin", "founder", "webmaster"] as const;
export const STAFF_ROLES = [...FULL_ADMIN_ROLES, "moderator"] as const;
export const ALL_ROLES = ["user", "moderator", "admin", "founder", "webmaster"] as const;

export const isFullAdmin = (role: string | null | undefined) => !!role && (FULL_ADMIN_ROLES as readonly string[]).includes(role);
export const isStaff = (role: string | null | undefined) => !!role && (STAFF_ROLES as readonly string[]).includes(role);
