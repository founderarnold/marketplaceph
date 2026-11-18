/**
 * Set by proxy.ts when it ends a session (logged out on another FLAME PH site, or the session expired).
 * Readable by the page on purpose: the header is drawn by the root layout, which client-side navigation keeps,
 * so components/auth/session-sync.tsx reloads once to show the signed-out header. It holds no secret.
 */
export const SESSION_ENDED_COOKIE = "mph_session_ended";
export const sessionEndedCookie = { path: "/", sameSite: "lax" as const, secure: true, httpOnly: false, maxAge: 60 * 5 };
