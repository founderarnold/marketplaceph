"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/business", "biz.nav.overview"],
  ["/business/customers", "biz.nav.customers"],
  ["/business/suppliers", "biz.nav.suppliers"],
  ["/business/reminders", "biz.nav.reminders"],
  ["/business/reports", "biz.nav.reports"],
  ["/business/finance", "biz.nav.finance"],
  ["/business/inventory", "biz.nav.inventory"],
  ["/business/affiliates", "biz.nav.affiliates"],
  ["/business/share", "biz.nav.share"],
  ["/business/sms", "biz.nav.sms"],
  ["/business/plan", "biz.nav.plan"],
] as const;

export function BusinessNav() {
  const { t } = useT();
  const path = usePathname();
  return (
    <nav aria-label={t("biz.title")} className="-mx-1 mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold">
      {ITEMS.map(([href, key]) => {
        const active = href === "/business" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center whitespace-nowrap rounded-lg px-3", active ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}>
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
