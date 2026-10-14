"use client";

import { Check, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setFriend } from "@/app/actions/social";
import { openAuth } from "@/components/auth/auth-modal";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * One-tap "Add Friend" (suki): adds the poster / store owner so their new items, jobs and updates show up in Updates.
 * Tapping again removes them. Guests get the sign-in popup.
 */
export function FriendButton({ targetUserId, initialAdded, signedIn, size = "md", className }: { targetUserId: string; initialAdded: boolean; signedIn: boolean; size?: "sm" | "md"; className?: string }) {
  const { t } = useT();
  const router = useRouter();
  const [added, setAdded] = useState(initialAdded);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    if (!signedIn) return openAuth("signup");
    const next = !added;
    setAdded(next); // optimistic
    setError(null);
    start(async () => {
      const res = await setFriend(targetUserId, next);
      if (!res.ok) {
        setAdded(!next);
        if (res.error === "auth") return openAuth();
        return setError(res.error && res.error !== "failed" && res.error !== "invalid" ? res.error : t("common.error"));
      }
      router.refresh();
    });
  }

  return (
    <span className={cn("inline-flex flex-col", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={added}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors disabled:opacity-60",
          size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-4",
          added ? "border border-success/40 bg-success-soft text-success hover:bg-success-soft/70" : "bg-brand text-white hover:bg-brand-dark",
        )}
      >
        {added ? <Check size={18} aria-hidden /> : <UserPlus size={18} aria-hidden />}
        {added ? t("friend.added") : t("friend.add")}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-danger">{error}</span>}
    </span>
  );
}
