import { grantPlan, revokePlan, runRemindersNow } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { nowMs, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { TIERS, tierByKey } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

const card = "rounded-2xl border border-border bg-white p-3 text-sm";
const select = "h-10 rounded-xl border border-border bg-white px-2";

function TierFields({ defaultTier, defaultBilling }: { defaultTier: string; defaultBilling?: string | null }) {
  return (
    <>
      <select name="tier" defaultValue={defaultTier} className={select} aria-label="Tier">
        {TIERS.filter((x) => x.rank > 0).map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
      </select>
      <select name="billing" defaultValue={defaultBilling ?? "monthly"} className={select} aria-label="Billing">
        <option value="monthly">monthly</option>
        <option value="yearly">yearly</option>
      </select>
    </>
  );
}

/** Admin → Plans: handle upgrade requests and grant/revoke a FLAME tier by hand (no payment provider is connected yet). */
export async function Plans({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: reqs }, { data: subs }, { count: queued }] = await Promise.all([
    supabase.from("plan_requests").select("id, user_id, plan, billing, note, created_at").eq("status", "open").order("created_at"),
    supabase.from("subscriptions").select("user_id, plan, billing, status, source, current_period_end, note, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("sms_outbox").select("id", { count: "exact", head: true }).eq("status", "queued"),
  ]);
  const ids = [...new Set([...(reqs ?? []).map((r) => r.user_id), ...(subs ?? []).map((s) => s.user_id)])];
  const { data: names } = ids.length ? await supabase.from("profiles").select("id, display_name").in("id", ids) : { data: [] };
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const live = (s: { status: string; current_period_end: string | null }) => s.status === "active" && (!s.current_period_end || new Date(s.current_period_end).getTime() > nowMs());

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("admin.plans_hint")}</p>

      <section className="space-y-2" aria-labelledby="rq-h">
        <h2 id="rq-h" className="font-bold text-brand-dark">{t("admin.plan_requests")}</h2>
        {!reqs?.length && <p className="rounded-2xl bg-muted p-4 text-center text-muted-foreground">{t("admin.none")}</p>}
        <ul className="space-y-2">
          {reqs?.map((r) => (
            <li key={r.id} className={card}>
              <p><b>{nm.get(r.user_id) ?? r.user_id.slice(0, 8)}</b> <span className="text-xs text-muted-foreground">· {tierByKey(r.plan).name} · {r.billing} · {timeAgo(r.created_at)}</span></p>
              {r.note && <p className="text-muted-foreground">“{r.note}”</p>}
              {isAdmin && (
                <form action={grantPlan.bind(null, r.user_id)} className="mt-2 flex flex-wrap gap-2">
                  <TierFields defaultTier={r.plan} defaultBilling={r.billing} />
                  <Input name="days" type="number" min={1} max={3650} placeholder={t("admin.plan_days")} className="h-10 w-40" />
                  <Input name="note" placeholder={t("admin.plan_note")} className="h-10 min-w-40 flex-1" />
                  <Button size="sm" type="submit">{t("admin.grant_plan")}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2" aria-labelledby="sub-h">
        <h2 id="sub-h" className="font-bold text-brand-dark">{t("admin.subscribers")}</h2>
        <ul className="space-y-2">
          {subs?.map((s) => (
            <li key={s.user_id} className={`${card} flex flex-wrap items-center gap-2`}>
              <span className="min-w-0 flex-1 font-semibold">{nm.get(s.user_id) ?? s.user_id.slice(0, 8)}</span>
              <Badge tone={live(s) ? "success" : "neutral"}>{live(s) ? tierByKey(s.plan).name : s.status}</Badge>
              <span className="text-xs text-muted-foreground">{s.source === "flame" ? "FLAME sync · " : ""}{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("en-PH") : t("plan.no_end")}{s.note ? ` · ${s.note}` : ""}</span>
              {isAdmin && (
                <>
                  <form action={grantPlan.bind(null, s.user_id)} className="flex gap-1">
                    <input type="hidden" name="days" value="30" />
                    <input type="hidden" name="tier" value={s.plan} />
                    <input type="hidden" name="billing" value={s.billing ?? "monthly"} />
                    <Button size="sm" variant="outline" type="submit">{t("admin.extend_30")}</Button>
                  </form>
                  {live(s) && <form action={revokePlan.bind(null, s.user_id)}><Button size="sm" variant="ghost" type="submit">{t("admin.revoke")}</Button></form>}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border border-border bg-white p-4" aria-labelledby="job-h">
        <h2 id="job-h" className="font-bold text-brand-dark">{t("admin.reminder_job")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.reminder_job_hint")}</p>
        <p className="text-sm">{t("admin.sms_queue", { n: queued ?? 0 })}</p>
        {isAdmin && <form action={runRemindersNow}><Button size="sm" variant="outline" type="submit">{t("admin.run_reminders")}</Button></form>}
      </section>
    </div>
  );
}
