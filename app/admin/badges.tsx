import { BadgeDecision, PinForm, RemoveBadgeButton, UnpinButton } from "@/components/admin/badge-forms";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const card = "rounded-2xl border border-border bg-white p-3 text-sm";

/** Admin → Badges & Featured: approve badge requests, see who holds which badge, and pin people to the home page. */
export async function BadgesAdmin({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  if (!isAdmin) return <p className={card}>{t("adminb.full_admin_only")}</p>;
  const supabase = await createClient();
  const [{ data: reqs }, { data: holders }, { data: pins }] = await Promise.all([
    supabase.from("badge_requests").select("id, user_id, badge, note, created_at").eq("status", "pending").order("created_at").limit(100),
    supabase.from("user_badges").select("user_id, badge, granted_at").order("granted_at", { ascending: false }).limit(200),
    supabase.from("featured_pins").select("user_id, kind, until, created_at").order("created_at", { ascending: false }),
  ]);
  const ids = [...new Set([...(reqs ?? []), ...(holders ?? []), ...(pins ?? [])].map((r) => r.user_id))];
  const [{ data: names }, { data: stores }] = await Promise.all([
    ids.length ? supabase.from("profiles").select("id, display_name").in("id", ids) : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    ids.length ? supabase.from("stores").select("owner_id, name, slug, year_started").in("owner_id", ids) : Promise.resolve({ data: [] as { owner_id: string; name: string; slug: string; year_started: number | null }[] }),
  ]);
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const st = new Map((stores ?? []).map((s) => [s.owner_id, s]));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">{t("adminb.pending")} ({reqs?.length ?? 0})</h2>
        {!reqs?.length && <p className="text-sm text-muted-foreground">{t("adminb.none")}</p>}
        {(reqs ?? []).map((r) => {
          const s = st.get(r.user_id);
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">
                {nm.get(r.user_id) ?? r.user_id} · <span className="text-brand">{t(`badge.${r.badge}`)}</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">{timeAgo(r.created_at)}</span>
              </p>
              {s && (
                <p className="text-xs text-muted-foreground">
                  {t("adminb.store")}: <a href={`/store/${s.slug}`} target="_blank" rel="noopener" className="text-brand underline">{s.name}</a>
                  {r.badge === "years_verified" && ` · ${t("adminb.claims_since", { year: s.year_started ?? "?" })}`}
                </p>
              )}
              {r.note && <p className="mt-1 whitespace-pre-line rounded-lg bg-muted p-2">{r.note}</p>}
              <BadgeDecision id={r.id} />
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">{t("adminb.featured")}</h2>
        <p className="text-sm text-muted-foreground">{t("adminb.featured_hint")}</p>
        <PinForm />
        <ul className="space-y-1">
          {(pins ?? []).map((p) => (
            <li key={p.user_id + p.kind} className={`${card} flex items-center justify-between gap-2`}>
              <span>
                <b>{nm.get(p.user_id) ?? p.user_id}</b> · {t(`featured.kind.${p.kind}`)}
                {p.until && <span className="text-xs text-muted-foreground"> · {t("adminb.until", { date: new Date(p.until).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" }) })}</span>}
              </span>
              <UnpinButton userId={p.user_id} kind={p.kind} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-brand-dark">{t("adminb.holders")}</h2>
        <ul className="space-y-1">
          {(holders ?? []).map((h) => (
            <li key={h.user_id + h.badge} className={`${card} flex items-center justify-between gap-2`}>
              <span><b>{nm.get(h.user_id) ?? h.user_id}</b> · {t(`badge.${h.badge}`)} <span className="text-xs text-muted-foreground">· {timeAgo(h.granted_at)}</span></span>
              {h.badge === "verified_rider" ? <a href="/admin?tab=riders&show=all" className="text-xs text-brand underline">{t("admin.tab.riders")}</a> : <RemoveBadgeButton userId={h.user_id} badge={h.badge} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
