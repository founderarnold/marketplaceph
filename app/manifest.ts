import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarketplacePH",
    short_name: "MarketplacePH",
    description: "Post for FREE. Find Customers. Buy Local. Sell Nationwide.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b4fd1",
    lang: "en-PH",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
