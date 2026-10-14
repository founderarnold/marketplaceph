import { BadgeCheck, Bike, Briefcase, CalendarCheck, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TFunction } from "@/lib/i18n/shared";
import type { FriendInfo } from "@/lib/social-data";

const icons = { verified_buyer: ShieldCheck, good_applicant: BadgeCheck, credible_employer: Briefcase, years_verified: CalendarCheck, verified_rider: Bike } as const;

/** Admin-approved badges ("Verified buyer", "Good applicant", "Credible employer", "Verified 10+ years in business"). */
export function ApprovedBadges({ badges, yearsSince, t }: { badges: string[]; yearsSince?: number | null; t: TFunction }) {
  if (!badges.length) return null;
  const years = yearsSince ? Math.max(1, new Date().getFullYear() - yearsSince) : null;
  return (
    <>
      {badges.map((b) => {
        const Icon = icons[b as keyof typeof icons] ?? BadgeCheck;
        const label = b === "years_verified" && years ? t("badge.years_verified_n", { n: years }) : t(`badge.${b}`);
        return (
          <Badge key={b} tone="success" title={t(`badge.${b}.desc`)}>
            <Icon size={13} aria-hidden /> {label}
          </Badge>
        );
      })}
    </>
  );
}

/** "12 friends · 3 suki" under a person or store. */
export function FriendStats({ info, t, className }: { info: Pick<FriendInfo, "friends" | "suki">; t: TFunction; className?: string }) {
  return (
    <span className={className ?? "inline-flex items-center gap-1 text-sm text-muted-foreground"}>
      <Users size={15} aria-hidden />
      <b className="text-foreground">{info.friends.toLocaleString("en-PH")}</b> {t(info.friends === 1 ? "friend.one" : "friend.many")}
      {info.suki > 0 && <> · <b className="text-foreground">{info.suki}</b> {t("friend.suki")}</>}
    </span>
  );
}

/** "✓ 24 sold · 3 bought · 2 jobs · 1 hire": successful transactions with this person, in every role they've had. */
export function TxStats({ counts, t, className }: { counts: { sold: number; bought: number; hired: number; hires: number }; t: TFunction; className?: string }) {
  const parts = (
    [
      ["sold", counts.sold],
      ["bought", counts.bought],
      ["hired", counts.hired],
      ["hires", counts.hires],
    ] as const
  ).filter(([, n]) => n > 0);
  return (
    <span className={className ?? "inline-flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground"} title={t("tx.title")}>
      <CheckCircle2 size={15} className="text-success" aria-hidden />
      {parts.length === 0 ? (
        <span>{t("tx.none")}</span>
      ) : (
        parts.map(([k, n], i) => (
          <span key={k}>
            {i > 0 && "· "}
            <b className="text-foreground">{n.toLocaleString("en-PH")}</b> {t(`tx.${k}`)}
          </span>
        ))
      )}
    </span>
  );
}
