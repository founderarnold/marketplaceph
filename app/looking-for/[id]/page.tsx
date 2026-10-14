import { CalendarClock, MapPin, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { SignInButton } from "@/components/auth/auth-modal";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { VerificationBadge } from "@/components/listing/badges";
import { budgetLabel, isOpen, placeOf, REQUEST_CARD_SELECT, type RequestCardData } from "@/components/requests/request-card";
import { OfferDecision, OfferForm, RequestOwnerActions, WithdrawOfferButton } from "@/components/requests/request-forms";
import { FriendButton } from "@/components/social/friend-button";
import { loadProfileLinks, ProfileLinks } from "@/components/social/profile-links";
import { ApprovedBadges, FriendStats, TxStats } from "@/components/social/social-ui";
import { buttonClass } from "@/components/ui/button";
import { formatPeso, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { loadFriendInfo, loadTxCounts, loadUserBadges } from "@/lib/social-data";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Buyer request" };

export default function RequestPage(props: PageProps<"/looking-for/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Request params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Request({ params, searchParams }: Pick<PageProps<"/looking-for/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: r } = await supabase.from("buy_requests").select(REQUEST_CARD_SELECT).eq("id", id).maybeSingle().overrideTypes<RequestCardData, { merge: false }>();
  if (!r) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  const me = (claims?.claims?.sub as string | undefined) ?? null;
  const isBuyer = me === r.buyer_id;
  const open = isOpen(r);

  const [{ data: buyer }, friend, badges, tx, links, { data: offers }, { data: myStore }] = await Promise.all([
    supabase.from("public_profiles").select("display_name").eq("id", r.buyer_id).maybeSingle(),
    loadFriendInfo(supabase, r.buyer_id, me),
    loadUserBadges(supabase, r.buyer_id),
    loadTxCounts(supabase, r.buyer_id),
    loadProfileLinks(supabase, r.buyer_id),
    // RLS: the buyer sees every offer; a seller sees only their own
    me ? supabase.from("buy_request_offers").select("id, seller_id, store_id, listing_id, unit_price, quantity, delivery_days, message, status, conversation_id, created_at, stores ( name, slug, verification_level ), listings ( title )").eq("request_id", id).order("created_at") : Promise.resolve({ data: [] }),
    me && !isBuyer ? supabase.from("stores").select("id").eq("owner_id", me).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: myListings } = myStore ? await supabase.from("listings").select("id, title").eq("store_id", myStore.id).eq("status", "active").order("created_at", { ascending: false }).limit(50) : { data: [] };
  const myOffer = (offers ?? []).find((o) => o.seller_id === me && o.status !== "withdrawn");
  const visibleOffers = (offers ?? []).filter((o) => isBuyer || o.seller_id === me);
  const where = placeOf(r);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Link href="/looking-for" className="text-sm font-semibold text-brand hover:underline">← {t("rq.board_title")}</Link>
        {sp.posted && <p role="status" className="rounded-xl bg-success-soft p-3 font-semibold text-success">✓ {t("rq.posted_ok")}</p>}
        <header className="space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-dark">{t(`rq.kind.${r.kind}`)}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-bold", open ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
              {open ? t("rq.status.open") : t(`rq.status.${r.status === "open" ? "expired" : r.status}`)}
            </span>
            <span className="text-muted-foreground">{timeAgo(r.created_at)}</span>
          </p>
          <h1 className="text-2xl font-extrabold text-brand-dark md:text-3xl">{r.title}</h1>
        </header>
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm">
          <div><dt className="text-muted-foreground">{t("rq.quantity")}</dt><dd className="font-semibold">{r.quantity != null ? `${Number(r.quantity).toLocaleString("en-PH")} ${r.unit ?? ""}` : "—"}</dd></div>
          <div><dt className="text-muted-foreground">{t("rq.budget")}</dt><dd className="font-semibold">{budgetLabel(r, t)}</dd></div>
          <div><dt className="text-muted-foreground">{t("rq.where")}</dt><dd className="flex items-center gap-1 font-semibold"><MapPin size={14} aria-hidden /> {where || "—"}</dd></div>
          <div><dt className="text-muted-foreground">{t("rq.needed_by")}</dt><dd className="flex items-center gap-1 font-semibold"><CalendarClock size={14} aria-hidden /> {r.needed_by ? new Date(`${r.needed_by}T00:00:00+08:00`).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" }) : "—"}</dd></div>
          {r.categories && <div className="col-span-2"><dt className="text-muted-foreground">{t("sell.category")}</dt><dd className="font-semibold">{locale === "fil" ? r.categories.name_fil : r.categories.name_en}</dd></div>}
        </dl>
        {r.details && (
          <section aria-labelledby="det-h">
            <h2 id="det-h" className="mb-1 font-bold text-brand-dark">{t("rq.details")}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">{r.details}</p>
          </section>
        )}

        {/* Offers: the buyer compares every offer; a seller sees only theirs */}
        <section aria-labelledby="offers-h" className="space-y-3">
          <h2 id="offers-h" className="text-lg font-bold text-brand-dark">{isBuyer ? t("rq.offers_for_you", { n: visibleOffers.filter((o) => o.status !== "withdrawn").length }) : t("rq.your_offer")}</h2>
          {isBuyer && visibleOffers.length === 0 && <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{open ? t("rq.no_offers_yet") : t("rq.no_offers")}</p>}
          <ul className="space-y-3">
            {visibleOffers.map((o) => {
              const total = o.unit_price != null && o.quantity != null ? Number(o.unit_price) * Number(o.quantity) : null;
              return (
                <li key={o.id} className={cn("space-y-2 rounded-2xl border bg-white p-4", o.status === "accepted" ? "border-success" : "border-border", o.status === "withdrawn" || o.status === "declined" ? "opacity-60" : "")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/store/${o.stores?.slug}`} className="font-bold text-brand-dark hover:underline">{o.stores?.name}</Link>
                      {o.stores && <VerificationBadge level={o.stores.verification_level} t={t} />}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", o.status === "accepted" ? "bg-success-soft text-success" : o.status === "sent" ? "bg-brand-soft text-brand-dark" : "bg-muted text-muted-foreground")}>{t(`rq.offer_status.${o.status}`)}</span>
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {o.unit_price != null && <div><dt className="inline text-muted-foreground">{t("rq.unit_price")}: </dt><dd className="inline font-bold">{formatPeso(Number(o.unit_price))}</dd></div>}
                    {o.quantity != null && <div><dt className="inline text-muted-foreground">{t("rq.can_supply")}: </dt><dd className="inline font-semibold">{Number(o.quantity).toLocaleString("en-PH")} {r.unit ?? ""}</dd></div>}
                    {total != null && <div><dt className="inline text-muted-foreground">{t("rq.total")}: </dt><dd className="inline font-bold text-brand-dark">{formatPeso(total)}</dd></div>}
                    {o.delivery_days != null && <div><dt className="inline text-muted-foreground">{t("rq.delivery_days")}: </dt><dd className="inline font-semibold">{o.delivery_days}</dd></div>}
                  </dl>
                  <p className="whitespace-pre-line text-sm">{o.message}</p>
                  {o.listing_id && o.listings && <Link href={`/listing/${o.listing_id}`} className="text-sm font-semibold text-brand underline">{t("rq.see_listing")}: {o.listings.title}</Link>}
                  <p className="text-xs text-muted-foreground">{timeAgo(o.created_at)}</p>
                  {isBuyer && o.status === "sent" && open && <OfferDecision offerId={o.id} requestId={r.id} />}
                  {o.conversation_id && <Link href={`/messages/${o.conversation_id}`} className={buttonClass("outline", "sm")}>{t("rq.open_chat")}</Link>}
                  {!isBuyer && o.status === "sent" && <WithdrawOfferButton offerId={o.id} requestId={r.id} />}
                </li>
              );
            })}
          </ul>
          {!isBuyer && !myOffer && (
            open ? (
              !me ? (
                <SignInButton className={buttonClass("accent", "lg", "w-full")}>{t("rq.sign_in_to_offer")}</SignInButton>
              ) : !myStore ? (
                <p className="rounded-2xl bg-accent-soft p-4 text-sm text-accent-strong">{t("rq.no_store")} <Link href="/sell/new" className="font-semibold underline">{t("nav.post_free")}</Link></p>
              ) : (
                <div className="rounded-2xl border-2 border-brand/30 bg-white p-4">
                  <h3 className="mb-2 font-bold text-brand-dark">{t("rq.make_offer")}</h3>
                  <OfferForm requestId={r.id} listings={myListings ?? []} defaultQty={r.quantity != null ? Number(r.quantity) : null} />
                </div>
              )
            ) : (
              <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{t("rq.closed_note")}</p>
            )
          )}
        </section>
      </div>

      <aside className="h-fit space-y-3 md:sticky md:top-32">
        <section aria-labelledby="buyer-h" className="space-y-2 rounded-2xl border border-border bg-white p-4">
          <h2 id="buyer-h" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("rq.posted_by")}</h2>
          <p className="font-bold text-brand-dark">{buyer?.display_name ?? t("comments.member")}</p>
          <div className="flex flex-wrap gap-1.5"><ApprovedBadges badges={badges.badges} t={t} /></div>
          <FriendStats info={friend} t={t} />
          <TxStats counts={tx} t={t} className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground" />
          <ProfileLinks links={links} t={t} />
          {!isBuyer && <FriendButton targetUserId={r.buyer_id} initialAdded={friend.added} signedIn={!!me} size="sm" />}
          <Link href={`/buyer/${r.buyer_id}`} className="block text-sm font-semibold text-brand hover:underline">{t("rq.buyer_page")}</Link>
        </section>
        {isBuyer && (
          <section className="space-y-2 rounded-2xl border border-border bg-white p-4">
            <h2 className="font-bold text-brand-dark">{t("rq.manage")}</h2>
            <RequestOwnerActions id={r.id} status={r.status} />
          </section>
        )}
        <aside className="flex gap-2 rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>{t("rq.safety")} <Link href="/faq#legit" className="font-semibold underline">{t("faq.title")}</Link></p>
        </aside>
      </aside>
    </div>
  );
}
