import { BadgeCheck, ChevronRight, Star, Users } from "lucide-react";
import Link from "next/link";
import type { FeaturedUser } from "@/lib/data";
import type { TFunction } from "@/lib/i18n/shared";
import { imageUrl } from "@/lib/images";

/** Home page: featured sellers, employers, applicants and buyers (ratings, badges and suki friends decide the order). */
export function FeaturedMembers({ rows, t }: { rows: { kind: string; users: FeaturedUser[]; more: string }[]; t: TFunction }) {
  const visible = rows.filter((r) => r.users.length > 0);
  if (!visible.length) return null;
  return (
    <section aria-labelledby="featured-members" className="space-y-5">
      <div>
        <h2 id="featured-members" className="text-xl font-bold text-brand-dark">★ {t("featured.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("featured.sub")}</p>
      </div>
      {visible.map(({ kind, users, more }) => (
        <div key={kind} className="space-y-2">
          <div className="flex items-end justify-between">
            <h3 className="font-bold text-brand-dark">{t(`featured.row.${kind}`)}</h3>
            <Link href={more} className="flex items-center gap-0.5 text-sm font-semibold text-brand hover:underline">
              {t("home.see_all")} <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            {users.map((u) => (
              <li key={u.user_id} className="w-48 shrink-0">
                <Link href={u.link} className="flex h-full flex-col rounded-2xl border border-border bg-white p-3 transition-shadow hover:border-brand hover:shadow-md">
                  <div className="flex items-center gap-2">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl(u.image, "store-assets")} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full border border-border bg-white object-contain" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-lg font-extrabold text-brand" aria-hidden>
                        {u.name.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                    {u.pinned && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold uppercase text-brand-dark">{t("featured.pinned")}</span>}
                  </div>
                  <p className="mt-2 line-clamp-1 font-bold text-brand-dark">{u.name}</p>
                  {u.subtitle && <p className="line-clamp-2 text-xs text-muted-foreground">{u.subtitle}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs text-muted-foreground">
                    {u.avg_rating != null && u.review_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                        <Star size={12} className="text-accent" fill="currentColor" aria-hidden /> {Number(u.avg_rating).toFixed(1)} ({u.review_count})
                      </span>
                    )}
                    <span className="inline-flex items-center gap-0.5"><Users size={12} aria-hidden /> {u.friends}</span>
                    {(u.badges.length > 0 || u.verification_level > 0) && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-success"><BadgeCheck size={12} aria-hidden /> {t("featured.verified")}</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
