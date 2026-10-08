export const AFFILIATE_COOKIE = "mph_aff";
export const AFFILIATE_COOKIE_DAYS = 30;

/** Public site origin (used to build share links, embed snippets and feed URLs). */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** The link an approved affiliate shares. */
export const affiliateUrl = (code: string) => `${siteUrl()}/r/${code}`;
