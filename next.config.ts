import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Social previews matter here (sellers share links on FB, Messenger, Viber, WhatsApp). The default bot
  // list doesn't include Viber & co., so serve <head> metadata (Open Graph) to everyone instead of streaming it.
  htmlLimitedBots: /.*/,
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
