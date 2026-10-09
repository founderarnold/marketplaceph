import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Footer, Header } from "@/components/layout/header";
import { RegisterSW } from "@/components/layout/register-sw";
import { LocaleProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "MarketplacePH — Post for FREE. Buy Local. Sell Nationwide.", template: "%s · MarketplacePH" },
  description:
    "The MSME-first online marketplace for the Philippines. Post products and services for free, find trusted local sellers and suppliers, and connect directly.",
  applicationName: "MarketplacePH",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon-64.png", apple: "/icons/apple-touch-icon.png" },
  openGraph: {
    siteName: "MarketplacePH",
    type: "website",
    locale: "en_PH",
    images: [{ url: "/brand/logo-wordmark.webp", width: 720, height: 329, alt: "MarketplacePH Online Store" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0b4fd1", width: "device-width", initialScale: 1 };

/** Request-time shell (reads language + session). The static part is the skeleton below. */
async function Shell({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const unread = data?.claims
    ? ((await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)).count ?? 0)
    : 0;
  const cartCount = data?.claims ? ((await supabase.from("cart_items").select("id", { count: "exact", head: true })).count ?? 0) : 0;
  const role = data?.claims ? (await supabase.from("profiles").select("role").eq("id", data.claims.sub as string).maybeSingle()).data?.role : null;
  const isStaff = role === "admin" || role === "moderator";
  return (
    <LocaleProvider locale={locale}>
      <AnnouncementBar signedIn={!!data?.claims} />
      <Header signedIn={!!data?.claims} unread={unread} cartCount={cartCount} isStaff={isStaff} t={t} />
      {/* min-height keeps the footer below the fold while page content streams in (prevents layout shift) */}
      <main className="mx-auto min-h-[85svh] w-full max-w-6xl flex-1 px-4 py-4 pb-24 md:pb-8">{children}</main>
      <Footer t={t} />
      <BottomNav />
      <RegisterSW />
    </LocaleProvider>
  );
}

function ShellFallback() {
  return (
    <>
      <div className="h-[104px] border-b border-border bg-white md:h-[62px]" aria-hidden />
      <div className="mx-auto min-h-[85svh] w-full max-w-6xl flex-1 px-4 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<ShellFallback />}>
          <Shell>{children}</Shell>
        </Suspense>
      </body>
    </html>
  );
}
