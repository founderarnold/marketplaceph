"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** "3:45 PM" today, "Oct 12, 3:45 PM" on older days. */
// Fixed to Philippine time so the server render and the browser agree (no hydration mismatch, no UTC times).
const TZ = "Asia/Manila";
const dayOf = (d: Date) => d.toLocaleDateString("en-PH", { timeZone: TZ });
function stamp(iso: string) {
  const d = new Date(iso);
  const today = dayOf(d) === dayOf(new Date());
  return d.toLocaleString("en-PH", today ? { timeZone: TZ, hour: "numeric", minute: "2-digit" } : { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  /** Automatic order / application update (shown as a centred card with a button), not something a person typed. */
  is_system?: boolean;
  system_kind?: string | null;
  system_link?: string | null;
};

export function ChatThread({
  conversationId,
  me,
  initial,
  kind = "shop",
}: {
  conversationId: string;
  me: string;
  initial: ChatMessage[];
  /** "shop" = buyer ⇄ seller, "job" = job applicant ⇄ employer (the id is then the job thread id). */
  kind?: "shop" | "job";
}) {
  const table = kind === "job" ? "job_messages" : "messages";
  const keyCol = kind === "job" ? "thread_id" : "conversation_id";
  const { t } = useT();
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  // Realtime: new messages in this conversation (RLS limits what the socket receives to participants).
  useEffect(() => {
    const markRead = () => (kind === "job" ? supabase.rpc("mark_job_thread_read", { p_thread: conversationId }) : supabase.rpc("mark_conversation_read", { p_conv: conversationId })).then(() => {});
    markRead();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter: `${keyCol}=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== me) markRead();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, me, supabase, kind, table, keyCol]);

  // Scroll only the message list (scrollIntoView would also scroll the whole page on every message).
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const cols = "id, sender_id, body, created_at, read_at, is_system, system_kind, system_link";
    const { data, error } =
      kind === "job"
        ? await supabase.from("job_messages").insert({ thread_id: conversationId, sender_id: me, body }).select(cols).single()
        : await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: me, body }).select(cols).single();
    setSending(false);
    if (error) return setError(error.message.includes("too fast") ? t("chat.too_fast") : t("common.error"));
    setText("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-80 flex-col rounded-2xl border border-border bg-white md:h-[60vh]">
      <ul ref={list} className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {messages.map((m) => {
          const mine = m.sender_id === me;
          if (m.is_system && m.system_kind) {
            const isOrder = m.system_kind.startsWith("order.");
            return (
              <li key={m.id} className="flex justify-center">
                <div className="w-full max-w-sm rounded-2xl border border-accent/40 bg-accent-soft px-3 py-2 text-center text-sm">
                  <p className="font-semibold text-brand-dark">{t(`sys.${m.system_kind}`)}</p>
                  {m.system_link && /^\/(orders|jobs|looking-for|delivery)\//.test(m.system_link) && (
                    <Link href={m.system_link} className="mt-1 inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-xs font-bold text-brand hover:bg-brand-soft">
                      {t(isOrder ? "sys.open_order" : m.system_kind.startsWith("request.") ? "sys.open_request" : m.system_kind.startsWith("delivery.") ? "sys.open_delivery" : "sys.open_application")} →
                    </Link>
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground">{stamp(m.created_at)}</span>
                </div>
              </li>
            );
          }
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-muted text-foreground")}>
                {m.body}
                <span className={cn("mt-1 block text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                  {stamp(m.created_at)}
                  {mine && m.read_at ? ` · ${t("chat.seen")}` : ""}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="px-3 pb-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          className="h-11 flex-1 rounded-full border border-border px-4 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-sky/40"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label={t("chat.send")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-brand-dark disabled:opacity-50"
        >
          <Send size={18} aria-hidden />
        </button>
      </form>
    </div>
  );
}
