"use client";

import { ChevronDown, CircleUserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/actions/auth";
import { useT } from "@/lib/i18n/client";

/** "Your account" dropdown: keeps the header to a few icons while every personal page stays one click away. */
export function AccountMenu({ isStaff }: { isStaff: boolean }) {
  const { t } = useT();
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();

  // close on navigation, outside click and Escape
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [path]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.removeAttribute("open");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        ref.current.removeAttribute("open");
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const groups: { href: string; label: string }[][] = [
    [
      { href: "/account", label: t("nav.account") },
      { href: "/orders", label: t("orders.title") },
      { href: "/favorites", label: t("nav.saved") },
      { href: "/messages", label: t("nav.messages") },
      { href: "/updates", label: t("nav.updates") },
      { href: "/account/badges", label: t("badges.title") },
      { href: "/faq", label: t("faq.title") },
    ],
    [
      { href: "/my/listings", label: t("nav.my_store") },
      { href: "/business", label: t("nav.business") },
      { href: "/sell/new", label: t("nav.post_free") },
    ],
    [
      { href: "/jobs/profile", label: t("nav.job_profile") },
      { href: "/jobs/applications", label: t("nav.job_applications") },
      { href: "/jobs/employer", label: t("nav.job_employer") },
    ],
    ...(isStaff ? [[{ href: "/admin", label: t("admin.title") }]] : []),
  ];

  return (
    <details ref={ref} className="group relative">
      <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-2 text-left hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        <CircleUserRound size={24} className="text-brand" aria-hidden />
        <span className="hidden leading-tight lg:block">
          <span className="block text-[11px] text-muted-foreground">{t("nav.hello")}</span>
          <span className="block text-sm font-bold text-brand-dark">{t("nav.your_account")}</span>
        </span>
        <ChevronDown size={14} className="text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-white p-2 shadow-xl">
        {groups.map((g, i) => (
          <ul key={i} className="border-b border-border py-1 last:border-0">
            {g.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-brand-soft hover:text-brand">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ))}
        <form action={signOut} className="pt-1">
          <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger-soft">{t("nav.logout")}</button>
        </form>
      </div>
    </details>
  );
}
