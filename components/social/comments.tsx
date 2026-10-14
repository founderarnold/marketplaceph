import { MessageSquare } from "lucide-react";
import { CommentForm, DeleteCommentButton } from "@/components/social/comment-forms";
import { timeAgo } from "@/lib/format";
import type { TFunction } from "@/lib/i18n/shared";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Public questions and comments on a listing or job post. Anyone signed in may ask; the seller / employer is marked
 * so buyers can spot official answers. Authors, the post owner and staff can delete.
 */
export async function CommentsSection({ supabase, kind, targetId, ownerId, me, t }: { supabase: Supabase; kind: "listing" | "job"; targetId: string; ownerId: string; me: string | null; t: TFunction }) {
  const { data: rows } = await supabase
    .from("comments")
    .select("id, author_id, body, created_at")
    .eq("target_kind", kind)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true })
    .limit(100);
  const ids = [...new Set((rows ?? []).map((r) => r.author_id))];
  const { data: people } = ids.length ? await supabase.from("public_profiles").select("id, display_name").in("id", ids) : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id, p.display_name]));
  const path = kind === "listing" ? `/listing/${targetId}` : `/jobs/${targetId}`;

  return (
    <section id="comments" aria-labelledby="comments-h" className="scroll-mt-32 space-y-3">
      <h2 id="comments-h" className="flex items-center gap-2 font-bold text-brand-dark">
        <MessageSquare size={18} aria-hidden /> {t("comments.title")} ({rows?.length ?? 0})
      </h2>
      {(rows ?? []).length === 0 ? (
        <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{t(kind === "listing" ? "comments.empty_listing" : "comments.empty_job")}</p>
      ) : (
        <ul className="space-y-2">
          {(rows ?? []).map((c) => {
            const isOwner = c.author_id === ownerId;
            return (
              <li key={c.id} className={`rounded-2xl border p-3 ${isOwner ? "border-brand/30 bg-brand-soft/50" : "border-border bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {name.get(c.author_id) ?? t("comments.member")}
                    {isOwner && <span className="ml-1.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t(kind === "listing" ? "comments.seller" : "comments.employer")}</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    <time className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</time>
                    {me && (me === c.author_id || me === ownerId) && <DeleteCommentButton id={c.id} path={path} />}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <CommentForm kind={kind} targetId={targetId} signedIn={!!me} isOwner={me === ownerId} />
    </section>
  );
}
