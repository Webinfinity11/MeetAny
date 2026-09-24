"use client";

// Messaging mechanics shared by the chat popup and the account inbox: one polling,
// read-marking and sending model, so both views always agree on unread state.
import { useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";
import { toast } from "../components/Toasts";

export type Message = { id: string; senderId: string; body: string; createdAt: string };
export type Conversation = {
  id: string; clientId: string; companyId: string; requestId: string | null; contextKey?: string | null;
  otherId?: string | null; otherName: string | null; otherCompany: string | null;
  createdAt: string; lastMessageAt: string | null; lastMessage: Message | null; unreadCount: number;
};
export type ChatTarget = { companyId: string; requestId?: string; conversation?: Conversation };

export const chatChanged = () => window.dispatchEvent(new Event("meetany:chat-changed"));
export const chatErrorText = (err: unknown) => (err as { userMessage?: string })?.userMessage || "მიმოწერა ვერ ჩაიტვირთა. სცადე ხელახლა.";

/** Runs `update` now, every `ms`, on tab return and on chat changes elsewhere; `active()` turns false on cleanup. */
function usePoll(update: ((active: () => boolean) => Promise<void>) | null, ms: number, deps: unknown[]) {
  useEffect(() => {
    if (!update) return;
    let on = true, busy = false;
    const run = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try { await update(() => on); } finally { busy = false; }
    };
    void run();
    const timer = window.setInterval(run, ms);
    window.addEventListener("meetany:chat-changed", run);
    document.addEventListener("visibilitychange", run);
    return () => { on = false; clearInterval(timer); window.removeEventListener("meetany:chat-changed", run); document.removeEventListener("visibilitychange", run); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Unread total for the signed-in user; null until the first answer. */
export function useUnreadMessageCount(store: Store | undefined, owner: string | undefined, enabled = true) {
  const read = store?.unreadMessageCount;
  const [result, setResult] = useState<{ owner: string; count: number } | null>(null);
  const failed = useRef(false);
  usePoll(owner && enabled && read ? async active => {
    try {
      const count = await read();
      if (active()) { setResult({ owner, count }); failed.current = false; }
    } catch (err) { if (active() && !failed.current) { toast(chatErrorText(err)); failed.current = true; } }
  } : null, 60000, [owner, enabled, read]);
  return result && result.owner === owner ? result.count : null;
}

/** The signed-in user's conversations, newest activity first (server order). */
export function useConversationList(store: Store | undefined, owner: string | undefined) {
  const list = store?.listConversations;
  const [result, setResult] = useState<{ owner: string; items?: Conversation[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  usePoll(owner && list ? async active => {
    try { const items: Conversation[] = await list(); if (active()) setResult({ owner, items }); }
    catch (err) { if (active()) { const error = chatErrorText(err); setResult({ owner, error }); toast(error); } }
  } : null, 60000, [owner, list, revision]);
  return { current: result?.owner === owner ? result : null, retry: () => setRevision(n => n + 1) };
}

/** One open conversation: starts it if needed, polls every 5s, marks read while visible, sends. */
export function useChatThread(store: Store, target: ChatTarget) {
  const { startConversation, listConversations, listMessages, markRead } = store;
  const alive = useRef(true);
  const sending = useRef(false);
  const [conversation, setConversation] = useState<Conversation | null>(target.conversation || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState("");
  const merge = (incoming: Message[]) => setMessages(old => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true, busy = false, hadError = false;
    let id = target.conversation?.id || "";
    let after: string | null = null;
    const update = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        if (!id) {
          const created: Conversation = await startConversation(target.companyId, target.requestId || null);
          if (!active) return;
          id = created.id;
          setConversation(created);
          const all: Conversation[] = await listConversations();
          if (!active) return;
          setConversation(all.find(c => c.id === id) || created);
          chatChanged();
        }
        const incoming: Message[] = await listMessages(id, after);
        if (!active) return;
        merge(incoming);
        // Advance only from the ordered fetch, never from a send response: a peer's
        // message may have committed between our last poll and our own send.
        if (incoming.length) after = incoming[incoming.length - 1].createdAt;
        setLoaded(true); setFailed(false);
        if (!document.hidden) { const result = await markRead(id); if (active && result.marked) chatChanged(); }
        hadError = false;
      } catch (err) {
        if (active) { setFailed(true); if (!hadError) toast(chatErrorText(err)); hadError = true; }
      } finally { busy = false; }
    };
    void update();
    const timer = window.setInterval(update, 5000);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [startConversation, listConversations, listMessages, markRead, target, revision]);
  /** Resolves true when the message was stored; `onStored` runs just before it joins the list. */
  async function send(body: string, onStored?: () => void) {
    if (!conversation || !loaded || sending.current || !body.trim() || body.length > 2000) return false;
    sending.current = true; setPending(true); setSendError("");
    try {
      const message: Message = await store.sendMessage(conversation.id, body.trim());
      if (!alive.current) return false;
      onStored?.(); merge([message]); chatChanged();
      return true;
    } catch (err) {
      if (alive.current) { const error = (err as { userMessage?: string })?.userMessage || "შეტყობინება ვერ გაიგზავნა. სცადე ხელახლა."; setSendError(error); toast(error); }
      return false;
    } finally { sending.current = false; if (alive.current) setPending(false); }
  }
  return { conversation, messages, loaded, failed, pending, sendError, send, retry: () => setRevision(n => n + 1) };
}
