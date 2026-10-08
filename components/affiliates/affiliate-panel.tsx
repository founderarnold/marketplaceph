import { Megaphone } from "lucide-react";
import Link from "next/link";
import { CopyLink, RequestAffiliateButton } from "@/components/affiliates/affiliate-forms";
import { affiliateUrl } from "@/lib/affiliate";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Shown on a listing whose seller enabled commissions. Anyone signed in can ask to promote it;
 * the link only works once the seller approves that person.
 */
export async function AffiliatePanel({ listingId, pct, userId, isOwner }: { listingId: string; pct: number; userId: string | null; isOwner: boolean }) {
  const { t } = await getT();
  let link: { code: string; status: string } | null = null;
  if (userId && !isOwner) {
    const supabase = await createClient();
    const { data } = await supabase.from("affiliate_links").select("code, status").eq("listing_id", listingId).eq("affiliate_id", userId).maybeSingle();
    link = data;
  }
  return (
    <section className="space-y-2 rounded-2xl border border-accent/50 bg-accent-soft p-4" aria-labelledby="aff-h">
      <h2 id="aff-h" className="flex items-center gap-2 font-bold text-brand-dark">
        <Megaphone size={18} aria-hidden /> {t("aff.panel_title", { pct })}
      </h2>
      <p className="text-sm">{t("aff.panel_body")}</p>
      {isOwner ? (
        <Link href="/business/affiliates" className="text-sm font-semibold text-brand underline">{t("aff.manage")}</Link>
      ) : !userId ? (
        <Link href={`/login?next=/listing/${listingId}`} className="text-sm font-semibold text-brand underline">{t("aff.login_to_promote")}</Link>
      ) : !link || link.status === "revoked" ? (
        <RequestAffiliateButton listingId={listingId} pct={pct} />
      ) : link.status === "pending" ? (
        <p className="text-sm font-semibold text-accent-strong">⏳ {t("aff.pending_note")}</p>
      ) : link.status === "rejected" ? (
        <p className="text-sm font-semibold text-danger">{t("aff.rejected_note")}</p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-success">✓ {t("aff.approved_note")}</p>
          <CopyLink url={affiliateUrl(link.code)} />
        </div>
      )}
    </section>
  );
}
