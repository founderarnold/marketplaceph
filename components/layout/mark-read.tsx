"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationsRead } from "@/app/actions/cases";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export function MarkRead() {
  const { t } = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markNotificationsRead();
          router.refresh();
        })
      }
    >
      {t("notif.mark_read")}
    </Button>
  );
}
