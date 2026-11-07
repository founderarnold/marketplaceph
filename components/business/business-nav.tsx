"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { FEATURE_MIN_RANK, tierFor, type Feature } from "@/lib/plans";
import { cn } from "@/lib/utils";

type Item = readonly [href: string, key: string, feature?: Feature];

/** The 12 business pages in four groups, so the bar never needs sideways scrolling to find a group. */
const GROUPS: readonly { key: string; items: readonly Item[] }[] = [
  { key: "sales", items: [["/business", "biz.nav.overview"], ["/business/customers", "biz.nav.customers"], ["/business/reports", "biz.nav.reports"]] },
  { key: "stock", items: [["/business/inventory", "biz.nav.inventory"], ["/business/suppliers", "biz.nav.suppliers"], ["/business/reminders", "biz.nav.reminders"]] },
  { key: "money", items: [["/business/finance", "biz.nav.finance"], ["/business/staff", "biz.nav.staff", "staff_dtr"]] },
  { key: "grow", items: [["/business/affiliates", "biz.nav.affiliates"], ["/business/share", "biz.nav.share"], ["/business/sms", "biz.nav.sms", "sms"], ["/business/plan", "biz.nav.plan"]] },
];

const isActive = (path: string, href: string) => (href === "/business" ? path === href : path.startsWith(href));

export function BusinessNav() {
  const { t } = useT();
  const path = usePathname();
  const current = GROUPS.find((g) => g.items.some(([href]) => isActive(path, href))) ?? GROUPS[0];
  return (
    <nav aria-label={t("biz.title")} className="mb-4 space-y-1.5">
      <ul className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-sm font-bold">
        {GROUPS.map((g) => (
          <li key={g.key}>
            <Link href={g.items[0][0]} aria-current={g === current ? "true" : undefined} className={cn("flex min-h-10 items-center justify-center rounded-lg px-1 text-center", g === current ? "bg-white text-brand shadow-sm" : "text-muted-foreground hover:text-brand")}>
              {t(`biz.group.${g.key}`)}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="flex flex-wrap gap-1 text-sm font-semibold">
        {current.items.map(([href, key, feature]) => (
          <li key={href}>
            <Link href={href} aria-current={isActive(path, href) ? "page" : undefined} className={cn("flex min-h-10 items-center gap-1.5 rounded-lg border px-3", isActive(path, href) ? "border-brand bg-brand-soft text-brand" : "border-border bg-white text-muted-foreground hover:text-brand")}>
              {t(key)}
              {feature && FEATURE_MIN_RANK[feature] > 0 && <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-accent-strong">{tierFor(feature).name.replace("FLAME ", "")}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
