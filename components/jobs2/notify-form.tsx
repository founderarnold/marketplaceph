"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BellRing } from "lucide-react";
import { saveJobAlert } from "@/app/actions/jobs2";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

/** Zero-match "notify me": saves the search for a signed-in member; visitors are sent to sign in and come back here. */
export function NotifyMeForm({ q, loc, category, signedIn, back }: { q: string; loc: string; category: string; signedIn: boolean; back: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(saveJobAlert, undefined);
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(back)}`} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 font-semibold text-brand-dark sm:w-auto">
        <BellRing size={18} aria-hidden /> {t("job2.notify_signin")}
      </Link>
    );
  }
  if (state?.ok) return <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">{t("job2.notify_saved")}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="q" value={q} />
      <input type="hidden" name="loc" value={loc} />
      <input type="hidden" name="category" value={category} />
      <Button type="submit" variant="outline" disabled={pending} className="w-full gap-2 sm:w-auto"><BellRing size={18} aria-hidden /> {t("job2.notify")}</Button>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error === "limit" ? t("job2.notify_limit") : t("common.error")}</p>}
    </form>
  );
}
