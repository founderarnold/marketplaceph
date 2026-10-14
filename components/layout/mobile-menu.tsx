"use client";

import {
  Bike,
  BriefcaseBusiness,
  Home,
  Languages,
  Menu,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SignInButton } from "@/components/auth/auth-modal";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string };

/**
 * Burger (☰) menu for phones and tablets: a panel from the left with every section of the site,
 * so nothing is hidden in the sideways-scrolling browse bar.
 */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const { t } = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // close when the page changes (a link was followed)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups: { title: string; icon: typeof Home; items: Item[] }[] = [
    {
      title: t("nav.shop"),
      icon: ShoppingBag,
      items: [
        { href: "/search", label: t("nav.shop") },
        { href: "/categories", label: t("nav.all_categories") },
        { href: "/looking-for", label: t("nav.looking_for") },
        {
          href: "/search?in_stock=1&sort=price_asc",
          label: t("nav.ready_stock"),
        },
        { href: "/categories?tab=suppliers", label: t("cat.tab.suppliers") },
        { href: "/categories?tab=services", label: t("cat.tab.services") },
        { href: "/categories?tab=negosyo", label: t("nav.negosyo") },
      ],
    },
    {
      title: t("nav.sell_menu"),
      icon: Store,
      items: [
        { href: "/sell/new", label: t("nav.post_free") },
        { href: "/sell", label: t("sell.see_all") },
        { href: "/my/listings", label: t("nav.my_store") },
        { href: "/business", label: t("nav.business") },
        { href: "/sell/verify", label: t("footer.verify") },
      ],
    },
    {
      title: t("nav.delivery"),
      icon: Bike,
      items: [
        { href: "/delivery/new", label: t("dl.book_cta") },
        { href: "/delivery", label: t("dl.riders_title") },
        { href: "/delivery/register", label: t("dl.register_cta") },
      ],
    },
    {
      title: t("nav.jobs"),
      icon: BriefcaseBusiness,
      items: [
        { href: "/jobs", label: t("home.seeker_cta") },
        { href: "/jobs/post", label: t("home.employer_cta") },
        { href: "/jobs/profile", label: t("nav.job_profile") },
      ],
    },
    {
      title: t("nav.community"),
      icon: Users,
      items: [
        { href: "/updates", label: t("nav.updates") },
        { href: "/check", label: t("nav.check_full") },
        { href: "/flame", label: t("nav.flame") },
        { href: "/faq", label: t("faq.title") },
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href.split("?")[0];

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.menu")}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-brand-dark hover:bg-brand-soft md:hidden"
      >
        <Menu size={26} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu")}
          >
            <button
              type="button"
              aria-label={t("auth.close")}
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/50"
            />
            <div
              ref={panel}
              id="mobile-menu"
              className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-wordmark.webp"
                  alt="MarketplacePH"
                  width={90}
                  height={40}
                  className="h-9 w-auto"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("auth.close")}
                  className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"
                >
                  <X size={22} aria-hidden />
                </button>
              </div>
              <nav
                className="flex-1 overflow-y-auto overscroll-contain px-2 pb-6 pt-2"
                aria-label={t("nav.menu")}
              >
                {!signedIn && (
                  <div className="mb-2 grid grid-cols-2 gap-2 px-1">
                    <SignInButton className="flex h-11 items-center justify-center rounded-xl border border-brand font-bold text-brand">
                      {t("nav.sign_in")}
                    </SignInButton>
                    <SignInButton
                      mode="signup"
                      className="flex h-11 items-center justify-center rounded-xl bg-accent font-bold text-brand-dark"
                    >
                      {t("nav.create_account")}
                    </SignInButton>
                  </div>
                )}
                <Link
                  href="/"
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-xl px-3 font-semibold",
                    isActive("/")
                      ? "bg-brand-soft text-brand"
                      : "hover:bg-muted",
                  )}
                >
                  <Home size={18} className="text-brand" aria-hidden />{" "}
                  {t("nav.home")}
                </Link>
                <Link
                  href="/sell/new"
                  className="mx-1 my-2 flex h-11 items-center justify-center gap-1.5 rounded-xl bg-accent font-bold text-brand-dark"
                >
                  <Plus size={18} aria-hidden /> {t("nav.post_free")}
                </Link>
                {groups.map((g) => (
                  <div key={g.title} className="mt-2">
                    <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <g.icon size={14} aria-hidden /> {g.title}
                    </p>
                    <ul>
                      {g.items.map((i) => (
                        <li key={i.href}>
                          <Link
                            href={i.href}
                            onClick={() => setOpen(false)}
                            aria-current={isActive(i.href) ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 items-center rounded-xl px-3 text-[15px]",
                              isActive(i.href)
                                ? "bg-brand-soft font-semibold text-brand"
                                : "text-foreground hover:bg-muted",
                            )}
                          >
                            {i.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border px-3 pt-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Languages size={16} aria-hidden /> {t("nav.language")}
                  </span>
                  <LanguageToggle />
                </div>
                <p className="mt-3 flex items-start gap-2 px-3 text-[11px] text-muted-foreground">
                  <ShieldCheck
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden
                  />{" "}
                  {t("nav.menu_safety")}
                </p>
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
