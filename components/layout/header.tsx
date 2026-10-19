import { Bell, Bike, BriefcaseBusiness, CircleUserRound, LayoutGrid, MessageCircle, Plus, Megaphone, ShoppingCart, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SignInButton } from "@/components/auth/auth-modal";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { SellMenu } from "@/components/layout/sell-menu";
import type { TFunction } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-brand-dark">{n > 9 ? "9+" : n}</span>;
}

const iconLink = "relative grid h-11 w-11 place-items-center rounded-xl text-brand hover:bg-brand-soft";

/**
 * Two-row header in the style of the big marketplaces:
 * row 1 = logo, one wide search, and a few icons (everything personal sits in the account menu);
 * row 2 = a slim navigation bar for browsing, with the one call to action (Post for FREE) on the right.
 */
export function Header({ signedIn, unread = 0, cartCount = 0, isStaff = false, msgUnread = 0, rank = null, t }: { signedIn: boolean; unread?: number; cartCount?: number; isStaff?: boolean; msgUnread?: number; rank?: number | null; t: TFunction }) {
  const links = [
    { href: "/search?in_stock=1&sort=price_asc", label: t("nav.ready_stock") },
    { href: "/categories?tab=suppliers", label: t("cat.tab.suppliers") },
    { href: "/categories?tab=services", label: t("cat.tab.services") },
    { href: "/categories?tab=negosyo", label: t("nav.negosyo") },
    { href: "/check", label: t("nav.check") },
  ];
  return (
    <header className="sticky top-0 z-30 overflow-x-clip bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 py-2 sm:gap-2 md:gap-4 md:px-4">
        <MobileMenu signedIn={signedIn} />
        <Link href="/" aria-label="MarketplacePH" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.webp" alt="MarketplacePH Online Store" width={104} height={46} className="h-10 w-auto md:h-11" />
        </Link>
        <div className="hidden flex-1 md:block">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <div className="hidden sm:block">
            <LanguageToggle />
          </div>
          {signedIn ? (
            <>
              <Link href="/messages" aria-label={t("nav.messages") + (msgUnread ? ` (${msgUnread})` : "")} title={t("nav.messages")} className={cn(iconLink, "hidden md:grid")}>
                <MessageCircle size={22} aria-hidden />
                <CountDot n={msgUnread} />
              </Link>
              <Link href="/notifications" aria-label={t("notif.title") + (unread ? ` (${unread})` : "")} title={t("notif.title")} className={iconLink}>
                <Bell size={22} aria-hidden />
                <CountDot n={unread} />
              </Link>
              <Link href="/cart" aria-label={t("cart.title") + (cartCount ? ` (${cartCount})` : "")} title={t("cart.title")} className={iconLink}>
                <ShoppingCart size={22} aria-hidden />
                <CountDot n={cartCount} />
              </Link>
              <AccountMenu isStaff={isStaff} />
            </>
          ) : (
            <>
              <SignInButton className="flex h-11 items-center gap-1.5 rounded-xl px-2 hover:bg-brand-soft">
                <CircleUserRound size={24} className="text-brand" aria-hidden />
                <span className="leading-tight">
                  <span className="hidden text-[11px] text-muted-foreground lg:block">{t("nav.hello_guest")}</span>
                  <span className="block text-sm font-bold text-brand-dark">{t("nav.sign_in")}</span>
                </span>
              </SignInButton>
              <SignInButton mode="signup" className="hidden h-10 items-center rounded-full bg-accent px-4 text-sm font-bold text-brand-dark hover:bg-[#ea6a0c] sm:inline-flex">
                {t("nav.create_account")}
              </SignInButton>
            </>
          )}
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>
      <nav aria-label={t("nav.browse")} className="bg-brand-dark text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 md:px-4">
          <ul className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1 text-sm font-medium [scrollbar-width:none]">
            <li className="shrink-0">
              <Link href="/categories" className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-bold hover:bg-white/15">
                <LayoutGrid size={16} aria-hidden /> {t("nav.all_categories")}
              </Link>
            </li>
            <li className="shrink-0">
              <Link href="/jobs" className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-bold text-accent hover:bg-white/15">
                <BriefcaseBusiness size={16} aria-hidden /> {t("nav.jobs")}
              </Link>
            </li>
            <li className="shrink-0">
              <Link href="/search" className="flex h-9 items-center whitespace-nowrap rounded-lg px-2.5 text-white/90 hover:bg-white/15 hover:text-white">
                {t("nav.shop")}
              </Link>
            </li>
            <li className="shrink-0">
              <Link href="/looking-for" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-semibold text-white hover:bg-white/15">
                <Megaphone size={16} className="text-accent" aria-hidden /> {t("nav.looking_for")}
              </Link>
            </li>
            <li className="shrink-0">
              <SellMenu rank={rank} />
            </li>
            <li className="shrink-0">
              <Link href="/delivery" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 font-semibold text-white hover:bg-white/15">
                <Bike size={16} className="text-accent" aria-hidden /> {t("nav.delivery")}
              </Link>
            </li>
            <li className="shrink-0">
              <Link href="/updates" className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-white/90 hover:bg-white/15 hover:text-white">
                <Users size={16} aria-hidden /> {t("nav.updates")}
              </Link>
            </li>
            {links.map((l) => (
              <li key={l.href} className="shrink-0">
                <Link href={l.href} className="flex h-9 items-center whitespace-nowrap rounded-lg px-2.5 text-white/90 hover:bg-white/15 hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/sell/new" className="my-1 hidden h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-4 text-sm font-bold text-brand-dark hover:bg-[#ea6a0c] md:inline-flex">
            <Plus size={16} aria-hidden /> {t("nav.post_free")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer({ t }: { t: TFunction }) {
  return (
    <footer className="mt-12 border-t border-border bg-muted pb-8 pt-8 text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <nav aria-label={t("footer.label")} className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { title: t("footer.buy"), links: [["/search", t("nav.shop")], ["/looking-for", t("nav.looking_for")], ["/categories", t("nav.all_categories")], ["/search?in_stock=1&sort=price_asc", t("nav.ready_stock")], ["/check", t("nav.check_full")]] },
            { title: t("nav.delivery"), links: [["/delivery/new", t("dl.book_cta")], ["/delivery", t("dl.riders_title")], ["/delivery/register", t("dl.register_cta")]] },
            { title: t("footer.sell"), links: [["/sell/new", t("nav.post_free")], ["/my/listings", t("nav.my_store")], ["/business", t("nav.business")], ["/sell/verify", t("footer.verify")], ["/business/plan", t("footer.plans")]] },
            { title: t("nav.jobs"), links: [["/jobs", t("home.seeker_cta")], ["/jobs/post", t("home.employer_cta")], ["/jobs/profile", t("nav.job_profile")]] },
            { title: t("brand.name"), links: [["/faq", t("faq.title")], ["/flame", t("nav.flame")], ["/account", t("nav.account")], ["/privacy", t("footer.privacy")], ["/terms", t("footer.terms")]] },
          ].map((col) => (
            <div key={col.title}>
              <p className="mb-2 font-bold text-brand-dark">{col.title}</p>
              <ul className="space-y-1.5">
                {col.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="hover:text-brand hover:underline">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="space-y-2 border-t border-border pt-5">
          <p className="font-semibold text-brand-dark">{t("brand.tagline")}</p>
          <p className="text-xs">{t("footer.disclaimer")}</p>
          <p className="text-xs">© MarketplacePH · FLAME PH MSME Ecosystem</p>
        </div>
      </div>
    </footer>
  );
}
