import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// A missing or placeholder value must not break the build; the CSP then only allows the local Supabase.
const supabase = URL.canParse(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!) : new URL("http://127.0.0.1:54321");
const supabaseWs = `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`;

/**
 * Content Security Policy: the browser only runs our own scripts, only talks to our site and our Supabase project,
 * and refuses to show our pages inside other sites' frames (stops click-jacking / look-alike "defaced" copies).
 * No nonces on purpose: nonces force every page to render per request, losing the cached static shell (see
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md → "Without Nonces"). 'unsafe-inline' scripts
 * are needed for Next's inline bootstrap without nonces; React escapes all user content and the app never injects
 * raw HTML, which is the real XSS defence here.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Images may come from any https address: uploads live in Supabase Storage, but older listings, store logos or
  // profile pictures (e.g. Google) can point elsewhere, and images can't run code. Scripts stay locked down above.
  `img-src 'self' data: blob: https: ${supabase.origin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase.origin} ${supabaseWs} https://api.ads.flameph.org`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // log-out hands off to flameph.org (one FLAME PH account); a no-JS form post may follow that redirect
  "form-action 'self' https://www.flameph.org",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Always HTTPS for two years, subdomains included (browsers remember it, so a downgrade attack can't strip TLS).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" }, // older browsers' version of frame-ancestors 'none'
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The site never needs these device features; deny them so injected content can't ask for them either.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false, // don't advertise the framework to scanners
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The storefront widget script and its data are meant to be loaded by sellers' own websites.
      { source: "/embed.js", headers: [{ key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
  // Social previews matter here (sellers share links on FB, Messenger, Viber, WhatsApp). Link-preview bots get
  // blocking <head> metadata (Open Graph); browsers keep streamed metadata. This is Next.js's default bot list plus
  // the chat apps it lacks (Viber, Telegram, LINE, Zalo, Pinterest, Snapchat, Embedly/Iframely). Matching every
  // user agent (/.*/) made dynamic routes like /listing/[id] fail to produce a static shell.
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Viber|TelegramBot|Line\/|Zalo|Pinterest|Snapchat|Embedly|Iframely|Googlebot/i,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
