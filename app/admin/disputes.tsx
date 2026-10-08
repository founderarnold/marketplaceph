import { resolveDispute } from "@/app/actions/admin";
import { OrderFileButton } from "@/components/admin/order-file-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { nowMs, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const card = "rounded-2xl border border-border bg-white p-3 text-sm";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Admin → Disputes: mediate order disputes. Files open only through logged, 60-second signed links. */
export async function Disputes({ isAdmin }: { isAdmin: boolean }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("disputes")
    .select("*, orders ( id, summary, amount, status, buyer_id, seller_id, cod, stores ( name ) )")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (!data?.length) return <p className="rounded-2xl bg-muted p-6 text-center">{t("admin.none")}</p>;

  const orderIds = data.map((d) => d.order_id);
  const [{ data: proofs }, { data: packs }, { data: ev }] = await Promise.all([
    supabase.from("payment_proofs").select("id, order_id, reference_no, status").in("order_id", orderIds),
    supabase.from("packing_proofs").select("id, order_id").in("order_id", orderIds),
    supabase.from("dispute_evidence").select("id, dispute_id, uploader_id").in("dispute_id", data.map((d) => d.id)),
  ]);
  const people = [...new Set(data.flatMap((d) => [d.orders.buyer_id, d.orders.seller_id]))];
  const { data: names } = await supabase.from("profiles").select("id, display_name").in("id", people);
  const nm = new Map((names ?? []).map((n) => [n.id, n.display_name]));
  const now = nowMs();

  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const o = d.orders;
        const windowOpen = d.status === "open" && !d.responded_at && new Date(d.response_due_at).getTime() > now;
        return (
          <li key={d.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={d.status === "open" ? "danger" : "neutral"}>{d.status === "open" ? t("dispute.status.open") : t("dispute.status.resolved")}</Badge>
              <b>{t(`dispute.reason.${d.reason}`)}</b>
              <span className="ml-auto text-xs text-muted-foreground">{timeAgo(d.created_at)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {o.stores.name} · {nm.get(o.buyer_id)} ({t("chat.buyer")}) ↔ {nm.get(o.seller_id)} · ₱{o.amount.toLocaleString("en-PH")} · {o.summary} {o.cod ? "· COD" : ""}
            </p>
            <p className="mt-2 whitespace-pre-line rounded-xl bg-muted p-2">
              <b>{d.opened_by === o.buyer_id ? t("chat.buyer") : t("order.seller")}:</b> {d.details}
            </p>
            {d.response_body && (
              <p className="mt-2 whitespace-pre-line rounded-xl border border-accent/40 bg-accent-soft p-2">
                <b>{t("dispute.other_side")}:</b> {d.response_body}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {(proofs ?? []).filter((p) => p.order_id === d.order_id).map((p) => (
                <OrderFileButton key={p.id} kind="payment" id={p.id} label={`${t("order.proof")} · ${p.reference_no} · ${p.status}`} />
              ))}
              {(packs ?? []).filter((p) => p.order_id === d.order_id).map((p, i) => (
                <OrderFileButton key={p.id} kind="packing" id={p.id} label={`${t("order.packing_proof")} ${i + 1}`} />
              ))}
              {(ev ?? []).filter((e) => e.dispute_id === d.id).map((e, i) => (
                <OrderFileButton key={e.id} kind="evidence" id={e.id} label={`${t("cases.evidence")} ${i + 1} (${e.uploader_id === o.buyer_id ? t("chat.buyer") : t("order.seller")})`} />
              ))}
            </div>
            {d.status === "open" &&
              (isAdmin ? (
                <form action={resolveDispute.bind(null, d.id)} className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className={cn("text-xs font-semibold", windowOpen ? "text-danger" : "text-success")}>
                    {d.responded_at ? t("admin.can_decide_responded") : windowOpen ? t("admin.window_open", { date: fmt(d.response_due_at) }) : t("admin.can_decide_expired")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Select name="outcome" defaultValue="no_fault" className="h-10 w-auto">
                      {["buyer_favored", "seller_favored", "partial", "no_fault"].map((k) => (
                        <option key={k} value={k}>{t(`dispute.outcome.${k}`)}</option>
                      ))}
                    </Select>
                    <Select name="result" defaultValue="" className="h-10 w-auto" aria-label={t("admin.dispute_result")}>
                      <option value="">{t("admin.dispute_result_auto")}</option>
                      <option value="completed">{t("order.status.completed")}</option>
                      <option value="cancelled">{t("order.status.cancelled")}</option>
                    </Select>
                  </div>
                  <Textarea name="note" required minLength={5} placeholder={t("admin.dispute_note")} className="min-h-16" />
                  <Button size="sm" type="submit">{t("admin.decide")}</Button>
                  <p className="text-xs text-muted-foreground">{t("admin.dispute_hint")}</p>
                </form>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">{t("admin.admin_only")}</p>
              ))}
            {d.status === "resolved" && (
              <p className="mt-2 text-xs">
                <b>{t("dispute.outcome")}:</b> {t(`dispute.outcome.${d.outcome}`)} — {d.admin_note}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
