"use client";

import { usePathname } from "next/navigation";

/** Hides the marketplace chrome (header, footer, bottom bar, banners) on a store's standalone Mini Website (/site/<store>). */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path.startsWith("/site/") ? null : children;
}
