"use client";

import { BriefcaseBusiness, MessageCircle, PlusCircle, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Mobile-first primary navigation (hidden on desktop). */
export function BottomNav({ unread = 0 }: { unread?: number }) {
  const { t } = useT();
  const path = usePathname();
  // Home is the logo in the header. "Buy" also lights up while browsing products, stores and categories.
  const items = [
    { href: "/jobs", icon: BriefcaseBusiness, label: t("nav.jobs"), match: ["/jobs"] },
    { href: "/search", icon: ShoppingBag, label: t("nav.shop"), match: ["/search", "/categories", "/listing", "/store", "/cart", "/checkout"] },
    { href: "/sell/new", icon: PlusCircle, label: t("nav.sell"), highlight: true, match: ["/sell"] },
    { href: "/messages", icon: MessageCircle, label: t("nav.messages"), match: ["/messages"] },
    { href: "/account", icon: User, label: t("nav.account"), match: ["/account"] },
  ];
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, icon: Icon, label, highlight, match }) => {
          const active = match.some((m) => path === m || path.startsWith(m + "/"));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                  highlight ? "text-accent-strong" : active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon size={highlight ? 28 : 22} aria-hidden />
                  {href === "/messages" && unread > 0 && <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-brand-dark">{unread > 9 ? "9+" : unread}</span>}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
