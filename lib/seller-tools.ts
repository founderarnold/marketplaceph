import {
  Boxes, BriefcaseBusiness, Calculator, Clock, Globe, LayoutDashboard, LineChart, Megaphone, MessageCircle, PlusCircle, Receipt, Scale, Store, UserRoundPen,
  type LucideIcon,
} from "lucide-react";
import type { Feature } from "@/lib/plans";

/**
 * The seller tools behind the header's "Sell" menu and the /sell hub, in menu order.
 * `feature` ties a tool to its plan entry in lib/plans.ts (what tier unlocks it); none = free for every member.
 * Texts live in messages/*.json as sell.tool.<key>.title / .desc and guide steps as guide.<key>.1…4.
 */
export type SellerTool = { key: string; href: string; icon: LucideIcon; group: "basics" | "business"; feature?: Feature; guideSteps: number };

export const SELLER_TOOLS: readonly SellerTool[] = [
  { key: "post", href: "/sell/new", icon: PlusCircle, group: "basics", guideSteps: 4 },
  { key: "my_store", href: "/my/listings", icon: Store, group: "basics", guideSteps: 3 },
  { key: "messages", href: "/messages", icon: MessageCircle, group: "basics", guideSteps: 3 },
  { key: "store_profile", href: "/my/store", icon: UserRoundPen, group: "basics", guideSteps: 3 },
  { key: "dashboard", href: "/business", icon: LayoutDashboard, group: "basics", guideSteps: 3 },
  { key: "hiring", href: "/jobs/post", icon: BriefcaseBusiness, group: "basics", guideSteps: 3 },
  { key: "mini_site", href: "/sell/website", icon: Globe, group: "business", feature: "mini_site", guideSteps: 3 },
  { key: "affiliates", href: "/business/affiliates", icon: Megaphone, group: "business", feature: "affiliates", guideSteps: 3 },
  { key: "costing", href: "/sell/tools/costing", icon: Calculator, group: "business", feature: "costing", guideSteps: 4 },
  { key: "break_even", href: "/sell/tools/break-even", icon: Scale, group: "business", feature: "break_even", guideSteps: 4 },
  { key: "pl", href: "/business/finance#pl", icon: LineChart, group: "business", feature: "finance_pl", guideSteps: 3 },
  { key: "inventory", href: "/business/inventory", icon: Boxes, group: "business", feature: "inventory", guideSteps: 3 },
  { key: "expenses", href: "/business/finance#expenses", icon: Receipt, group: "business", feature: "finance_basic", guideSteps: 3 },
  { key: "staff_dtr", href: "/business/staff", icon: Clock, group: "business", feature: "staff_dtr", guideSteps: 4 },
];

export const toolByKey = (key: string) => SELLER_TOOLS.find((t) => t.key === key)!;
