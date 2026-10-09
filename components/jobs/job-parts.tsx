"use client";

import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { getJobDocumentUrl } from "@/app/actions/jobs";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const NAV = [
  ["/jobs", "job.nav.find"],
  ["/jobs/applications", "job.nav.applications"],
  ["/jobs/messages", "job.nav.messages"],
  ["/jobs/profile", "job.nav.profile"],
  ["/jobs/employer", "job.nav.employer"],
  ["/jobs/post", "job.nav.post"],
] as const;

/** Sub-navigation shared by every /jobs page. */
export function JobsNav() {
  const { t } = useT();
  const path = usePathname();
  const active = (href: string) => (href === "/jobs" ? path === "/jobs" || /^\/jobs\/[0-9a-f-]{36}$/.test(path) : path === href || (href !== "/jobs/post" && path.startsWith(href + "/")));
  return (
    <nav aria-label={t("job.title")} className="-mx-1 mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold">
      {NAV.map(([href, key]) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={cn("flex min-h-10 items-center whitespace-nowrap rounded-lg px-3", active(href) ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}

/** Opens a private document with a short-lived link. Employers can only open what the applicant shared; each open is logged. */
export function JobDocButton({ id, label }: { id: string; label: string }) {
  const { t } = useT();
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(false);
            const res = await getJobDocumentUrl(id);
            if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
            else setErr(true);
          })
        }
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-brand-dark hover:bg-muted disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FileText size={14} aria-hidden />} {label}
      </button>
      {err && <span role="alert" className="text-xs text-danger">{t("common.error")}</span>}
    </span>
  );
}
