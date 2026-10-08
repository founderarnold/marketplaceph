"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { setLocale } from "@/app/actions/locale";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const { locale } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function set(next: Locale) {
    if (next === locale) return;
    start(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label="Language" className={cn("inline-flex rounded-full border border-border p-0.5 text-xs font-bold", pending && "opacity-60")}>
      {(["en", "fil"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={locale === l}
          className={cn("rounded-full px-2.5 py-1", locale === l ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted")}
        >
          {l === "en" ? "EN" : "FIL"}
        </button>
      ))}
    </div>
  );
}
