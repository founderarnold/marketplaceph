import { Info } from "lucide-react";
import type { Metadata } from "next";
import { ProBadge, ProNote } from "@/components/business/pro-note";
import { SmsSetupForm } from "@/components/business/forms";
import { businessContext } from "@/lib/business";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "SMS setup" };

export default async function SmsPage() {
  const { supabase, userId, can, t } = await businessContext();
  const pro = can("sms");
  const [{ data: settings }, { data: queue }] = await Promise.all([
    supabase.from("sms_settings").select("phone, enabled").eq("user_id", userId).maybeSingle(),
    supabase.from("sms_outbox").select("id, to_phone, status, kind, created_at").eq("from_user", userId).order("created_at", { ascending: false }).limit(10),
  ]);
  const queued = (queue ?? []).filter((q) => q.status === "queued").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-brand-dark">{t("biz.sms_setup")} <ProBadge t={t} need="sms" /></h1>
        <p className="text-sm text-muted-foreground">{t("sms.intro")}</p>
      </div>

      {!pro ? (
        <>
          <ProNote t={t} need="sms" feature={t("sms.free_note")} />
          <ul className="list-disc space-y-1 rounded-2xl bg-muted p-4 pl-8 text-sm">
            <li>{t("sms.point1")}</li>
            <li>{t("sms.point2")}</li>
            <li>{t("sms.point3")}</li>
          </ul>
        </>
      ) : (
        <>
          <p className="flex gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-dark">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden /> {t("sms.provider_note")}
          </p>
          <SmsSetupForm phone={settings?.phone ?? ""} enabled={settings?.enabled ?? false} />
          <section aria-labelledby="q-h" className="space-y-2">
            <h2 id="q-h" className="font-bold text-brand-dark">{t("sms.queue")} {queued > 0 && <span className="rounded-full bg-accent-soft px-2 text-xs">{t("sms.waiting", { n: queued })}</span>}</h2>
            {queue?.length ? (
              <ul className="space-y-1 text-sm">{queue.map((q) => <li key={q.id} className="flex justify-between rounded-xl border border-border bg-white px-3 py-2"><span>{q.to_phone.replace(/\d(?=\d{3})/g, "•")}</span><span className="text-muted-foreground">{t(`sms.status.${q.status}`)} · {timeAgo(q.created_at)}</span></li>)}</ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("sms.queue_empty")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
