import { BriefcaseBusiness, Megaphone, Store, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { FriendButton } from "@/components/social/friend-button";
import { FriendStats } from "@/components/social/social-ui";
import { DeleteUpdateButton, UpdateComposer } from "@/components/social/update-composer";
import { priceLabel, timeAgo } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { thumbUrl } from "@/lib/images";
import { salaryLabel } from "@/lib/jobs";
import { loadFriendInfo } from "@/lib/social-data";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Updates" };

const TABS = ["feed", "friends", "followers", "mine"] as const;
type Tab = (typeof TABS)[number];

export default function UpdatesPage(props: PageProps<"/updates">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Updates searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Updates({ searchParams }: Pick<PageProps<"/updates">, "searchParams">) {
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "feed";
  const before = typeof sp.before === "string" && !Number.isNaN(Date.parse(sp.before)) ? sp.before : null;
  const { t } = await getT();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub as string | undefined;
  if (!me) redirect("/login?next=/updates");

  const [info, { data: myStore }, { data: myJobs }] = await Promise.all([
    loadFriendInfo(supabase, me, null),
    supabase.from("stores").select("id").eq("owner_id", me).limit(1).maybeSingle(),
    supabase.from("job_posts").select("id, title").eq("owner_id", me).eq("status", "active").order("created_at", { ascending: false }).limit(20),
  ]);
  const { data: myListings } = myStore
    ? await supabase.from("listings").select("id, title").eq("store_id", myStore.id).eq("status", "active").order("created_at", { ascending: false }).limit(30)
    : { data: [] as { id: string; title: string }[] };
  const linkable = [
    ...(myListings ?? []).map((l) => ({ value: `listing:${l.id}`, label: `🛒 ${l.title}` })),
    ...(myJobs ?? []).map((j) => ({ value: `job:${j.id}`, label: `💼 ${j.title}` })),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-dark">{t("updates.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("updates.intro")}</p>
        </div>
        <span className="text-right text-sm">
          <FriendStats info={info} t={t} />
          <span className="block text-xs text-muted-foreground">{t("updates.you_added", { n: info.following })}</span>
        </span>
      </div>

      <nav aria-label={t("updates.title")} className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1 text-sm font-semibold">
        {TABS.map((x) => (
          <Link key={x} href={x === "feed" ? "/updates" : `/updates?tab=${x}`} aria-current={tab === x ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2", tab === x ? "bg-white text-brand shadow-sm" : "text-muted-foreground")}>
            {t(`updates.tab.${x}`)}
          </Link>
        ))}
      </nav>

      {tab === "feed" && (
        <>
          <UpdateComposer items={linkable} />
          <Feed before={before} />
        </>
      )}
      {tab === "friends" && <People me={me} which="friends" />}
      {tab === "followers" && <People me={me} which="followers" />}
      {tab === "mine" && <MyUpdates me={me} />}
    </div>
  );
}

async function Feed({ before }: { before: string | null }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("friends_feed", { p_before: before ?? undefined, p_limit: 30 });
  const items = rows ?? [];
  if (!items.length) {
    return (
      <div className="space-y-3 rounded-2xl bg-muted p-6 text-center">
        <Users size={32} className="mx-auto text-muted-foreground" aria-hidden />
        <p className="font-semibold text-brand-dark">{before ? t("updates.no_more") : t("updates.empty_title")}</p>
        {!before && <p className="text-sm text-muted-foreground">{t("updates.empty_body")}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/search" className="inline-flex min-h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white">{t("nav.shop")}</Link>
          <Link href="/jobs" className="inline-flex min-h-10 items-center rounded-xl border border-border bg-white px-4 text-sm font-semibold">{t("nav.jobs")}</Link>
        </div>
      </div>
    );
  }
  return (
    <>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.kind + it.item_id} className="rounded-2xl border border-border bg-white p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {it.kind === "update" ? <Megaphone size={14} className="text-accent-strong" aria-hidden /> : it.kind === "listing" ? <Store size={14} className="text-brand" aria-hidden /> : <BriefcaseBusiness size={14} className="text-brand" aria-hidden />}
              <b className="text-foreground">{it.actor_name}</b>
              {t(`updates.kind.${it.kind}`)} · {timeAgo(it.created_at)}
            </p>
            {it.kind === "update" && (
              <div className="mt-1 space-y-1">
                <p className="whitespace-pre-line break-words text-sm">{it.body}</p>
                {it.link_slug && it.title && (
                  <Link href={it.title === "job" ? `/jobs/${it.link_slug}` : `/listing/${it.link_slug}`} className="text-sm font-semibold text-brand hover:underline">
                    {t(it.title === "job" ? "updates.see_job" : "updates.see_item")} →
                  </Link>
                )}
              </div>
            )}
            {it.kind === "listing" && (
              <Link href={`/listing/${it.item_id}`} className="mt-2 flex gap-3 rounded-xl p-1 hover:bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl(it.image_path)} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{it.title}</span>
                  <span className="block text-sm font-bold text-brand-dark">{priceLabel({ price_type: it.price_type ?? "message", price_min: it.price_min, price_max: it.price_max, unit: it.unit ?? "pc" }, t)}</span>
                </span>
              </Link>
            )}
            {it.kind === "job" && (
              <Link href={`/jobs/${it.item_id}`} className="mt-2 block rounded-xl p-1 hover:bg-muted">
                <span className="block font-semibold">{it.title}</span>
                <span className="block text-sm text-muted-foreground">{salaryLabel(it.price_min, it.price_max, null, (p) => p) ?? t("updates.see_job")}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      {items.length >= 30 && (
        <Link href={`/updates?before=${encodeURIComponent(items[items.length - 1].created_at)}`} className="block rounded-xl border border-border bg-white p-3 text-center text-sm font-semibold text-brand hover:bg-muted">
          {t("updates.older")}
        </Link>
      )}
    </>
  );
}

/** People I added ("friends") or people who added me ("followers"), with a button to add / remove. */
async function People({ me, which }: { me: string; which: "friends" | "followers" }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: rows } =
    which === "friends"
      ? await supabase.from("follows").select("followee_id, created_at").eq("follower_id", me).order("created_at", { ascending: false }).limit(300)
      : await supabase.from("follows").select("follower_id, created_at").eq("followee_id", me).order("created_at", { ascending: false }).limit(300);
  const ids = (rows ?? []).map((r) => ("followee_id" in r ? r.followee_id : r.follower_id) as string);
  if (!ids.length) return <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t(which === "friends" ? "updates.no_friends" : "updates.no_followers")}</p>;
  const [{ data: people }, { data: stores }, { data: back }] = await Promise.all([
    supabase.from("public_profiles").select("id, display_name").in("id", ids),
    supabase.from("stores").select("owner_id, name, slug").in("owner_id", ids),
    which === "followers" ? supabase.from("follows").select("followee_id").eq("follower_id", me).in("followee_id", ids) : Promise.resolve({ data: [] as { followee_id: string }[] }),
  ]);
  const nm = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  const st = new Map((stores ?? []).map((s) => [s.owner_id, s]));
  const addedBack = new Set((back ?? []).map((b) => b.followee_id));
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-white">
      {ids.map((id) => {
        const s = st.get(id);
        const mutual = which === "friends" || addedBack.has(id);
        return (
          <li key={id} className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{s?.name ?? nm.get(id) ?? t("comments.member")}</span>
              {s && <Link href={`/store/${s.slug}`} className="text-xs font-semibold text-brand hover:underline">{t("my.view_store")}</Link>}
            </span>
            <FriendButton targetUserId={id} initialAdded={mutual} signedIn size="sm" />
          </li>
        );
      })}
    </ul>
  );
}

async function MyUpdates({ me }: { me: string }) {
  const { t } = await getT();
  const supabase = await createClient();
  const { data: rows } = await supabase.from("user_updates").select("id, body, created_at").eq("author_id", me).order("created_at", { ascending: false }).limit(50);
  if (!rows?.length) return <p className="rounded-2xl bg-muted p-6 text-center text-sm text-muted-foreground">{t("updates.mine_empty")}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((u) => (
        <li key={u.id} className="flex items-start justify-between gap-2 rounded-2xl border border-border bg-white p-3">
          <span className="min-w-0">
            <p className="whitespace-pre-line break-words text-sm">{u.body}</p>
            <time className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</time>
          </span>
          <DeleteUpdateButton id={u.id} />
        </li>
      ))}
    </ul>
  );
}
