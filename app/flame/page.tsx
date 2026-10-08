import { BookOpen, Banknote, CalendarDays, Handshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "FLAME PH" };

// Placeholders for the FLAME PH MSME Ecosystem. Each becomes a real link / integration as FLAME PH opens it.
const HOOKS = [
  ["training", BookOpen],
  ["financing", Banknote],
  ["mentoring", Handshake],
  ["events", CalendarDays],
] as const;

export default async function FlamePage() {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold text-brand-dark">{t("flame.title")}</h1>
        <p className="text-muted-foreground">{t("flame.intro")}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/business/plan" className={buttonClass("accent", "md")}>{t("flame.see_plans")}</Link>
          <Link href="/sell/new" className={buttonClass("outline", "md")}>{t("nav.post_free")}</Link>
        </div>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {HOOKS.map(([key, Icon]) => (
          <li key={key} className="space-y-1 rounded-2xl border border-border bg-white p-4">
            <Icon size={22} className="text-brand" aria-hidden />
            <h2 className="font-bold text-brand-dark">{t(`flame.${key}`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`flame.${key}_body`)}</p>
            <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{t("flame.soon")}</span>
          </li>
        ))}
      </ul>
      <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">{t("flame.sync_note")}</p>
    </div>
  );
}
