import { loadFlameBadge } from "@/lib/flame-badge";

/** The FLAME PH badge next to the seller's name. Shows nothing unless flameph.org says so. */
export async function FlameBadgeChip({ ownerId }: { ownerId: string }) {
  const b = await loadFlameBadge(ownerId).catch(() => null);
  if (!b) return null;
  const top = Object.entries(b.categories).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => k).join(", ");
  const since = b.memberSince ? new Date(`${b.memberSince}-01T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
  const detail = [`${b.counted} confirmed ${b.counted === 1 ? "deal" : "deals"} on FLAME PH`, top && `mostly ${top}`, since && `member since ${since}`, b.verified && "business documents verified"].filter(Boolean).join(" · ");
  return (
    <span
      className="rounded-full border border-brand/30 bg-white px-2.5 py-0.5 text-xs font-bold text-brand-dark"
      title={`${detail}. A status badge from FLAME PH, not a certification or a guarantee.`}
    >
      FLAME PH {b.level}{b.verified ? " · Verified" : ""}
      <span className="sr-only">. {detail}. A status badge from FLAME PH, not a certification or a guarantee.</span>
    </span>
  );
}
