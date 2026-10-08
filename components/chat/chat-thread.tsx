"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ChatMessage = { id: string; sender_id: string; body: string | null; created_at: string; read_at: string | null };

export function ChatThread({
  conversationId,
  me,
  initial,
}: {
  conversationId: string;
  me: string;
  initial: ChatMessage[];
}) {
  const { t } = useT();
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Realtime: new messages in this conversation (RLS limits what the socket receives to participants).
  useEffect(() => {
    supabase.rpc("mark_conversation_read", { p_conv: conversationId }).then(() => {});
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== me) supabase.rpc("mark_conversation_read", { p_conv: conversationId }).then(() => {});
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, me, supabase]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body })
      .select("id, sender_id, body, created_at, read_at")
      .single();
    setSending(false);
    if (error) return setError(error.message.includes("too fast") ? t("chat.too_fast") : t("common.error"));
    setText("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-80 flex-col rounded-2xl border border-border bg-white md:h-[60vh]">
      <ul className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-muted text-foreground")}>
                {m.body}
                <span className={cn("mt-1 block text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}
                  {mine && m.read_at ? ` · ${t("chat.seen")}` : ""}
                </span>
              </div>
            </li>
          );
        })}
        <div ref={bottom} />
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
