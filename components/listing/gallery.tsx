"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Listing photos: a swipeable square strip (phones) with arrows and a thumbnail row (desktop), so every photo is
 * reachable without a trackpad. The strip stays a native scroll-snap container; the controls just scroll it.
 */
export function Gallery({ urls, thumbs, alt }: { urls: string[]; thumbs: string[]; alt: string }) {
  const { t } = useT();
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function go(i: number) {
    const el = strip.current;
    if (!el) return;
    const next = (i + urls.length) % urls.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    setIndex(next);
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={strip}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none]"
          aria-label={t("listing.photos")}
        >
          {urls.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src + i}
              src={src}
              alt={`${alt} ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : undefined}
              className="aspect-square w-full shrink-0 snap-center bg-muted object-cover"
            />
          ))}
        </div>
        {urls.length > 1 && (
          <>
            <button type="button" onClick={() => go(index - 1)} aria-label={t("listing.prev_photo")} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-dark shadow hover:bg-white">
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label={t("listing.next_photo")} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-dark shadow hover:bg-white">
              <ChevronRight size={22} aria-hidden />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
              {index + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto">
          {thumbs.map((src, i) => (
            <li key={src + i} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t("listing.show_photo", { n: i + 1 })}
                aria-current={i === index}
                className={cn("block overflow-hidden rounded-lg border-2", i === index ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={64} height={64} loading="lazy" className="h-16 w-16 bg-muted object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
