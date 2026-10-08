import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ProposeDealForm } from "@/components/deals/deal-forms";
import { ChatThread } from "@/components/chat/chat-thread";
import { priceLabel } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { firstThumb } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat" };

export default function ThreadPage(props: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <Thread params={props.params} />
    </Suspense>
  );
}

async function Thread({ params }: Pick<PageProps<"/messages/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: convo } = await supabase
    .from("conversations")
    .select(
      `id, buyer_id, stores!inner ( id, name, slug, owner_id ),
       listings ( id, title, price_type, price_min, price_max, unit, listing_images ( path, position ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!convo) notFound();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at, read_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  const iAmSeller = convo.stores.owner_id === me;
  let title = convo.stores.name;
  if (iAmSeller) {
    const { data: buyer } = await supabase.from("public_profiles").select("display_name").eq("id", convo.buyer_id).maybeSingle();
    title = buyer?.display_name ?? t("chat.buyer");
  }
  const listing = convo.listings;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Link href="/messages" className="text-sm font-semibold text-brand hover:underline">
          ← {t("nav.messages")}
        </Link>
        <h1 className="truncate text-lg font-bold text-brand-dark">{title}</h1>
        {!iAmSeller && (
          <Link href={`/store/${convo.stores.slug}`} className="ml-auto text-sm text-brand hover:underline">
            {t("chat.view_store")}
          </Link>
        )}
      </div>

      {listing && (
        <Link href={`/listing/${listing.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2 hover:bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={firstThumb(listing.listing_images)} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{listing.title}</p>
            <p className="text-sm font-bold text-brand-dark">{priceLabel(listing, t)}</p>
          </div>
        </Link>
      )}

      {iAmSeller && <ProposeDealForm conversationId={convo.id} />}
      {iAmSeller && (
        <Link href={`/buyer/${convo.buyer_id}`} className="block text-sm font-semibold text-brand hover:underline">
          {t("chat.buyer_sheet")}
        </Link>
      )}
      <ChatThread conversationId={convo.id} me={me} initial={msgs ?? []} />
      <p className="rounded-xl bg-brand-soft p-3 text-xs text-brand-dark">{t("safety.tip")}</p>
    </div>
  );
}
