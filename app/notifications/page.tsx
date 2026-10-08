import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarkRead } from "@/components/layout/mark-read";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("id, kind, params, link, read_at, created_at").order("created_at", { ascending: false }).limit(50);
  const hasUnread = (data ?? []).some((n) => !n.read_at);

  const text = (kind: string, params: Record<string, unknown>) => {
    const p: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" || typeof v === "number") p[k] =
        k === "outcome"
          ? t(kind === "dispute_resolved" ? `dispute.outcome.${v}` : `case.status.${v}`)
          : k === "reason"
            ? t(kind === "dispute_opened" ? `dispute.reason.${v}` : `report.reason.${v}`)
            : v;
    }
    if (typeof params.appeal_by === "string") p.appeal_by = new Date(params.appeal_by).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    if (typeof params.level === "number") p.level = params.level === 3 ? t("verify.business") : t("verify.id");
    if (kind === "appeal_decided" && typeof params.outcome === "string") p.outcome = t(`appeal.status.${params.outcome}`);
    return t(`notif.${kind}`, p);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-brand-dark">{t("notif.title")}</h1>
        {hasUnread && <MarkRead />}
      </div>
      {!data?.length ? (
        <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("notif.empty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {data.map((n) => {
            const params = (n.params ?? {}) as Record<string, unknown>;
            const rawNote = params.note ?? params.message;
            const note = typeof rawNote === "string" && rawNote ? rawNote : null;
            const body = (
              <div className="flex gap-3 p-3">
                <Bell size={18} className={cn("mt-0.5 shrink-0", n.read_at ? "text-muted-foreground" : "text-accent")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-semibold")}>{text(n.kind, params)}</p>
                  {note && <p className="mt-0.5 text-sm text-muted-foreground">“{note}”</p>}
                  <time className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</time>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-muted">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
