import { BadgeCheck, Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvailabilityToggle, RiderForm } from "@/components/delivery/delivery-forms";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buttonClass } from "@/components/ui/button";
import { getLocations } from "@/lib/data";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Register as a delivery rider" };

export default function RegisterRiderPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RegisterRider />
    </Suspense>
  );
}

async function RegisterRider() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect("/login?next=/delivery/register");
  const [{ t }, locations, { data: rider }, { data: profile }] = await Promise.all([
    getT(),
    getLocations(),
    supabase.from("rider_profiles").select("*").eq("user_id", me).maybeSingle(),
    supabase.from("profiles").select("display_name").eq("id", me).single(),
  ]);
  const status = rider?.status ?? null;
  const tone: Record<string, string> = {
    pending: "bg-accent-soft text-accent-strong",
    approved: "bg-success-soft text-success",
    needs_more: "bg-accent-soft text-accent-strong",
    rejected: "bg-danger-soft text-danger",
    suspended: "bg-danger-soft text-danger",
  };
  const canEdit = status !== "pending" && status !== "suspended";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/delivery" className="text-sm font-semibold text-brand hover:underline">← {t("nav.delivery")}</Link>
        <h1 className="mt-1 text-2xl font-extrabold text-brand-dark">{t("dl.reg_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dl.reg_intro")}</p>
      </div>

      {status && (
        <section className={cn("space-y-2 rounded-3xl p-5", tone[status])} aria-live="polite">
          <p className="flex items-center gap-2 text-lg font-extrabold">
            {status === "approved" ? <BadgeCheck size={22} aria-hidden /> : <Clock size={22} aria-hidden />} {t(`dl.rider_status.${status}`)}
          </p>
          <p className="text-sm text-foreground">{t(`dl.rider_status.${status}.desc`)}</p>
          {rider?.admin_note && status !== "approved" && <p className="rounded-xl bg-white p-3 text-sm text-foreground"><b>{t("dl.admin_note")}:</b> {rider.admin_note}</p>}
          {status === "approved" && rider && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-sm text-foreground">{rider.is_available ? t("dl.you_online") : t("dl.you_offline")}</span>
              <AvailabilityToggle on={rider.is_available} />
              <Link href="/delivery?view=jobs" className={buttonClass("accent", "md")}>{t("dl.see_jobs")}</Link>
            </div>
          )}
        </section>
      )}

      {!status && (
        <section className="grid gap-3 rounded-3xl bg-brand-soft p-5 sm:grid-cols-3">
          {(["1", "2", "3"] as const).map((n) => (
            <div key={n} className="flex gap-2 text-sm text-brand-dark">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
              <span>{t(`dl.reg_step${n}`)}</span>
            </div>
          ))}
        </section>
      )}

      {canEdit ? (
        <>
          {status === "approved" && <p className="text-sm text-muted-foreground">{t("dl.update_note")}</p>}
          <RiderForm
            userId={me}
            locations={locations}
            defaultName={profile?.display_name ?? ""}
            current={rider}
          />
        </>
      ) : null}

      <p className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden /> {t("dl.reg_privacy")}
      </p>
    </div>
  );
}
