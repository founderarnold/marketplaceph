"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { captureAttribution, recordJobEvent } from "@/app/actions/jobs2";
import type { JobEvent, JobEventProps } from "@/lib/jobs-events";

/** Sends one funnel event after the page shows (and, on the landing, captures UTM/chapter attribution first). */
export function JobsTracker({ name, props, capture = false }: { name: JobEvent; props?: JobEventProps; capture?: boolean }) {
  const sent = useRef(false);
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    (async () => {
      if (capture) await captureAttribution(window.location.search).catch(() => {});
      await recordJobEvent(name, JSON.parse(key)).catch(() => {});
    })();
  }, [name, key, capture]);
  return null;
}

/** A link that records `signup_start` (or another event) before leaving. Navigation never waits on analytics. */
export function TrackedLink({ event, href, className, children }: { event: JobEvent; href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => { recordJobEvent(event, { source: "jobs_landing" }).catch(() => {}); }}>
      {children}
    </Link>
  );
}
