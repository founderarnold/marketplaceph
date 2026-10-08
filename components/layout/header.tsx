import { Bell, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { SearchBar } from "@/components/layout/search-bar";
import { buttonClass } from "@/components/ui/button";
import type { TFunction } from "@/lib/i18n/shared";

export function Header({ signedIn, unread = 0, cartCount = 0, t }: { signedIn: boolean; unread?: number; cartCount?: number; t: TFunction }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Link href="/" aria-label="MarketplacePH" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-wordmark.webp" alt="MarketplacePH Online Store" width={104} height={46} className="h-11 w-auto" />
        </Link>
        <div className="hidden flex-1 md:block">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <Link href="/check" className={buttonClass("ghost", "sm", "hidden lg:inline-flex")}>
            {t("nav.check")}
          </Link>
          <Link href="/sell/new" className={buttonClass("accent", "sm", "hidden md:inline-flex")}>
            {t("nav.post_free")}
          </Link>
          {signedIn ? (
            <>
              <Link href="/cart" aria-label={t("cart.title") + (cartCount ? ` (${cartCount})` : "")} className="relative grid h-11 w-11 place-items-center rounded-xl text-brand hover:bg-brand-soft">
                <ShoppingCart size={20} aria-hidden />
                {cartCount > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-brand-dark">{cartCount > 9 ? "9+" : cartCount}</span>}
              </Link>
              <Link href="/notifications" aria-label={t("notif.title") + (unread ? ` (${unread})` : "")} className="relative grid h-11 w-11 place-items-center rounded-xl text-brand hover:bg-brand-soft">
                <Bell size={20} aria-hidden />
                {unread > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-brand-dark">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <Link href="/messages" className={buttonClass("ghost", "sm", "hidden md:inline-flex")}>
                {t("nav.messages")}
              </Link>
              <Link href="/favorites" className={buttonClass("ghost", "sm", "hidden md:inline-flex")}>
                {t("nav.saved")}
              </Link>
              <Link href="/business" className={buttonClass("ghost", "sm", "hidden lg:inline-flex")}>
                {t("nav.business")}
              </Link>
              <Link href="/my/listings" className={buttonClass("ghost", "sm", "hidden md:inline-flex")}>
                {t("nav.my_store")}
              </Link>
              <form action={signOut}>
                <button className={buttonClass("outline", "sm")}>{t("nav.logout")}</button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonClass("primary", "sm")}>
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden">
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>
    </header>
  );
}

export function Footer({ t }: { t: TFunction }) {
  return (
    <footer className="mt-12 border-t border-border bg-muted pb-24 pt-8 text-sm text-muted-foreground md:pb-8">
      <div className="mx-auto max-w-6xl space-y-2 px-4">
        <p className="font-semibold text-brand-dark">{t("brand.tagline")}</p>
        <p>{t("brand.hook")}</p>
        <p className="text-xs">{t("footer.disclaimer")}</p>
        <p className="text-sm font-semibold"><Link href="/check" className="text-brand underline">{t("nav.check_full")}</Link> · <Link href="/flame" className="text-brand underline">{t("nav.flame")}</Link></p>
        <p className="text-xs">© MarketplacePH · FLAME PH MSME Ecosystem</p>
      </div>
    </footer>
  );
}
