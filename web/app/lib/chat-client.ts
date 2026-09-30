"use client";

// Messaging mechanics shared by the chat popup and the account inbox: one polling,
// read-marking and sending model, so both views always agree on unread state.
import { useEffect, useRef, useState } from "react";
import type { Store } from "./market-client";
import { toast } from "../components/Toasts";

export type Message = { id: string; senderId: string; body: string; createdAt: string; readAt?: string | null };
export type Conversation = {
  id: string; clientId: string; companyId: string; requestId: string | null; contextKey?: string | null;
  otherId?: string | null; otherName: string | null; otherCompany: string | null;
  createdAt: string; lastMessageAt: string | null; lastMessage: Message | null; unreadCount: number;
};
export type ChatTarget = { companyId: string; requestId?: string; conversation?: Conversation };

export const chatChanged = () => window.dispatchEvent(new Event("meetany:chat-changed"));
export const chatErrorText = (err: unknown) => (err as { userMessage?: string })?.userMessage || "მიმოწერა ვერ ჩაიტვირთა. სცადე ხელახლა.";

type Feed = { unread: number | null; list: { items?: Conversation[]; error?: string } | null };
type Source = {
  state: Feed; listeners: Set<() => void>; listSubs: number;
  read?: () => Promise<number>; list?: () => Promise<Conversation[]>;
  run: () => Promise<void>; stop?: () => void;
};
const sources = new Map<string, Source>();

/** One 10 s poll per signed-in user feeds every badge and inbox list: the list when anyone shows it
 *  (its unread counts give the total), otherwise the unread count alone. Also runs on tab return
 *  and on chat changes elsewhere. */
function feed(owner: string): Source {
  let source = sources.get(owner);
  if (source) return source;
  let busy = false, again = false, failed = false;
  const src: Source = {
    state: { unread: null, list: null }, listeners: new Set(), listSubs: 0,
    run: async () => {
      if (document.hidden || !src.listeners.size) return;
      // A viewer that joins mid-request (a list after the badge) gets one more run right after.
      if (busy) { again = true; return; }
      busy = true; again = false;
      try {
        if (src.listSubs && src.list) {
          const items = await src.list();
          src.state = { unread: items.reduce((n, c) => n + c.unreadCount, 0), list: { items } };
        } else if (src.read) {
          src.state = { ...src.state, unread: await src.read() };
        } else return;
        failed = false;
      } catch (err) {
        const error = chatErrorText(err);
        // Keep the open thread mounted on background failures so its draft survives.
        if (src.listSubs) src.state = { ...src.state, list: { ...src.state.list, error } };
        if (!failed) toast(error);
        failed = true;
      } finally { busy = false; }
      src.listeners.forEach(fn => fn());
      if (again) void src.run();
    },
  };
  sources.set(owner, source = src);
  return source;
}

function useFeed(store: Store | undefined, owner: string | undefined, wantsList: boolean): [Feed | null, () => void] {
  const read = store?.unreadMessageCount, list = store?.listConversations;
  const [state, setState] = useState<{ owner: string; feed: Feed } | null>(null);
  const on = !!owner && !!(wantsList ? list : read);
  useEffect(() => {
    if (!owner || !on) return;
    const src = feed(owner);
    src.read = read; src.list = list;
    const update = () => setState({ owner, feed: src.state });
    src.listeners.add(update);
    if (wantsList) src.listSubs++;
    if (src.listeners.size === 1) {
      const run = () => void src.run();
      const timer = window.setInterval(run, 10000);
      window.addEventListener("meetany:chat-changed", run);
      document.addEventListener("visibilitychange", run);
      src.stop = () => { clearInterval(timer); window.removeEventListener("meetany:chat-changed", run); document.removeEventListener("visibilitychange", run); };
    }
    // A new list viewer needs items now; a badge reuses what the feed already has.
    if (src.state.unread === null || (wantsList && !src.state.list)) void src.run(); else update();
    return () => {
      src.listeners.delete(update);
      if (wantsList) src.listSubs--;
      if (!src.listeners.size) { src.stop?.(); sources.delete(owner); }
    };
  }, [owner, on, wantsList, read, list]);
  return [state && state.owner === owner ? state.feed : null, () => { if (owner) void sources.get(owner)?.run(); }];
}

/** Unread total for the signed-in user; null until the first answer. */
export function useUnreadMessageCount(store: Store | undefined, owner: string | undefined, enabled = true) {
  const [current] = useFeed(store, enabled ? owner : undefined, false);
  return current ? current.unread : null;
}

/** The signed-in user's conversations, newest activity first (server order). */
export function useConversationList(store: Store | undefined, owner: string | undefined) {
  const [current, retry] = useFeed(store, owner, true);
  return { current: current?.list && owner ? { owner, ...current.list } : null, retry };
}

/** One open conversation: starts it if needed, polls every 5s, marks read while visible, sends. */
export function useChatThread(store: Store, target: ChatTarget, enabled = true) {
  const { startConversation, listConversations, listMessages, markRead, currentUser } = store;
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
    if (!enabled) return;
    let active = true, busy = false, hadError = false;
    let id = target.conversation?.id || "";
    let after: string | null = null;
    let unread = (target.conversation?.unreadCount || 0) > 0;
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
          const found = all.find(c => c.id === id);
          if (found?.unreadCount) unread = true;
          setConversation(found || created);
          chatChanged();
        }
        const incoming: Message[] = await listMessages(id, after);
        if (!active) return;
        merge(incoming);
        const me = currentUser()?.id;
        if (incoming.some(m => m.senderId !== me && !m.readAt)) unread = true;
        // Advance only from the ordered fetch, never from a send response: a peer's
        // message may have committed between our last poll and our own send.
        if (incoming.length) after = incoming[incoming.length - 1].createdAt;
        setLoaded(true); setFailed(false);
        // Mark read only when the other side has something unread; an idle open chat writes nothing.
        if (unread && !document.hidden) { const result = await markRead(id); unread = false; if (active && result.marked) chatChanged(); }
        hadError = false;
      } catch (err) {
        if (active) { setFailed(true); if (!hadError) toast(chatErrorText(err)); hadError = true; }
      } finally { busy = false; }
    };
    void update();
    const timer = window.setInterval(update, 5000);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [startConversation, listConversations, listMessages, markRead, currentUser, target, revision, enabled]);
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
