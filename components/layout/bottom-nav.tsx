"use client";

import { BriefcaseBusiness, Home, MessageCircle, PlusCircle, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/** Mobile-first primary navigation (hidden on desktop). */
export function BottomNav() {
  const { t } = useT();
  const path = usePathname();
  const items = [
    { href: "/", icon: Home, label: t("nav.home") },
    { href: "/jobs", icon: BriefcaseBusiness, label: t("nav.jobs") },
    { href: "/sell/new", icon: PlusCircle, label: t("nav.sell"), highlight: true },
    { href: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { href: "/account", icon: User, label: t("nav.account") },
  ];
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, icon: Icon, label, highlight }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
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
                <Icon size={highlight ? 28 : 22} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
