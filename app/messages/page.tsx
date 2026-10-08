import type { Metadata } from "next";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { imageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function InboxPage() {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string;

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, buyer_id, last_message_at, stores!inner ( name, slug, logo_url, owner_id ), listings ( title )")
    .order("last_message_at", { ascending: false })
    .limit(50);

  const ids = (convos ?? []).map((c) => c.id);
  const { data: recent } = ids.length
    ? await supabase.from("messages").select("conversation_id, sender_id, body, created_at, read_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(400)
    : { data: [] };

  // Buyers' display names (public view; no phone/email exposed).
  const buyerIds = [...new Set((convos ?? []).filter((c) => c.stores.owner_id === me).map((c) => c.buyer_id))];
  const { data: buyers } = buyerIds.length ? await supabase.from("public_profiles").select("id, display_name").in("id", buyerIds) : { data: [] };
  const buyerName = new Map((buyers ?? []).map((b) => [b.id, b.display_name]));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold text-brand-dark">{t("nav.messages")}</h1>
      {(convos ?? []).length === 0 ? (
        <p className="rounded-2xl bg-muted p-8 text-center text-muted-foreground">{t("chat.empty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {(convos ?? []).map((c) => {
            const msgs = (recent ?? []).filter((m) => m.conversation_id === c.id);
            const last = msgs[0];
            const unread = msgs.filter((m) => m.sender_id !== me && !m.read_at).length;
            const iAmSeller = c.stores.owner_id === me;
            const name = iAmSeller ? (buyerName.get(c.buyer_id) ?? t("chat.buyer")) : c.stores.name;
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.stores.logo_url ? imageUrl(c.stores.logo_url, "store-assets") : "/brand/logo-mark.webp"} alt="" className="h-12 w-12 shrink-0 rounded-full border border-border bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{name}</p>
                      <time className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</time>
                    </div>
                    {c.listings && <p className="truncate text-xs text-brand">{c.listings.title}</p>}
                    <p className={`truncate text-sm ${unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{last?.body ?? "—"}</p>
                  </div>
                  {unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-brand-dark">{unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
