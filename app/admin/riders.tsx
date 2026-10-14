import { RiderDocButton, RiderReviewForm } from "@/components/delivery/delivery-forms";
import { Badge } from "@/components/ui/badge";
import { timeAgo, todayPH } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

const card = "space-y-2 rounded-2xl border border-border bg-white p-3 text-sm";

/** Admin → Riders: check a rider's license, OR/CR and plate photos, then approve (grants "Verified rider") or send back. */
export async function RidersAdmin({ isAdmin, show }: { isAdmin: boolean; show: string }) {
  const { t } = await getT();
  if (!isAdmin) return <p className={card}>{t("adminb.full_admin_only")}</p>;
  const supabase = await createClient();
  const statuses = show === "all" ? ["approved", "needs_more", "rejected", "suspended"] : ["pending"];
  const [{ data: riders }, { count: pending }] = await Promise.all([
    supabase
      .from("rider_profiles")
      .select("*, region:psgc_regions(name), province:psgc_provinces(name), city:psgc_cities(name), rider_documents(id, doc_type)")
      .in("status", statuses)
      .order("submitted_at", { ascending: show !== "all" })
      .limit(100),
    supabase.from("rider_profiles").select("user_id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const today = todayPH();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href="/admin?tab=riders" className={show === "all" ? "text-sm font-semibold text-brand underline" : "text-sm font-bold text-brand-dark"}>{t("dl.admin.pending", { n: pending ?? 0 })}</a>
        <span aria-hidden>·</span>
        <a href="/admin?tab=riders&show=all" className={show === "all" ? "text-sm font-bold text-brand-dark" : "text-sm font-semibold text-brand underline"}>{t("dl.admin.reviewed")}</a>
      </div>
      <p className="text-xs text-muted-foreground">{t("dl.admin.howto")}</p>
      {!riders?.length && <p className="text-sm text-muted-foreground">{t("adminb.none")}</p>}
      {(riders ?? []).map((r) => {
        const expired = r.license_expiry < today;
        return (
          <div key={r.user_id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-brand-dark">{r.full_name} <span className="font-normal text-muted-foreground">· {timeAgo(r.submitted_at)}</span></p>
              <Badge tone={r.status === "approved" ? "success" : r.status === "pending" ? "accent" : "danger"}>{t(`dl.rider_status.${r.status}`)}</Badge>
            </div>
            <dl className="grid gap-1 sm:grid-cols-2">
              <div><dt className="inline text-muted-foreground">{t("dl.mobile")}: </dt><dd className="inline">{r.phone}</dd></div>
              <div><dt className="inline text-muted-foreground">{t("dl.vehicle_type")}: </dt><dd className="inline">{t(`dl.vehicle.${r.vehicle_type}`)}{r.vehicle_model ? ` · ${r.vehicle_model}` : ""}</dd></div>
              <div><dt className="inline text-muted-foreground">{t("dl.plate")}: </dt><dd className="inline font-mono font-bold">{r.plate_number}</dd></div>
              <div><dt className="inline text-muted-foreground">{t("dl.license_no")}: </dt><dd className="inline font-mono">{r.license_number}</dd></div>
              <div>
                <dt className="inline text-muted-foreground">{t("dl.license_expiry")}: </dt>
                <dd className={expired ? "inline font-bold text-danger" : "inline"}>{r.license_expiry}{expired && ` (${t("dl.admin.expired")})`}</dd>
              </div>
              <div><dt className="inline text-muted-foreground">{t("dl.service_area")}: </dt><dd className="inline">{[r.city?.name, r.province?.name, r.region?.name].filter(Boolean).join(", ")}</dd></div>
            </dl>
            {r.about && <p className="rounded-lg bg-muted p-2">{r.about}</p>}
            <div className="flex flex-wrap gap-1.5">
              {r.rider_documents.map((d) => <RiderDocButton key={d.id} id={d.id} label={t(`dl.doc.${d.doc_type}`)} />)}
            </div>
            {r.admin_note && r.status !== "pending" && <p className="text-xs text-muted-foreground">{t("dl.admin_note")}: {r.admin_note}</p>}
            <RiderReviewForm userId={r.user_id} status={r.status} />
          </div>
        );
      })}
    </div>
  );
}
