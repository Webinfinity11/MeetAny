"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { CompanyAvatar } from "./CompanyAvatar";
import { Icon } from "../Icon";
import { toast } from "../Toasts";

type Message = { id: string; senderId: string; body: string; createdAt: string };
export type Conversation = {
  id: string; clientId: string; companyId: string; requestId: string | null;
  otherName: string | null; otherCompany: string | null;
  createdAt: string; lastMessageAt: string | null; lastMessage: Message | null; unreadCount: number;
};
type ChatTarget = { companyId: string; requestId?: string; conversation?: Conversation };
const changed = () => window.dispatchEvent(new Event("meetany:chat-changed"));
const errorText = (err: unknown) => (err as { userMessage?: string })?.userMessage || "მიმოწერა ვერ ჩაიტვირთა. სცადე ხელახლა.";
export const chatDate = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
};
export function openChat(target: ChatTarget) {
  window.dispatchEvent(new CustomEvent("meetany:chat-open", { detail: target }));
}

export function MessageButton({ companyId, requestId }: { companyId: string; requestId?: string }) {
  const { store, ready } = useMarketStore();
  const router = useRouter();
  const me = ready ? store?.currentUser() : null;
  if (me?.id === companyId && !requestId) return null;
  return <button type="button" className="ma-btn ma-btn--secondary" disabled={!ready || !!me?.blocked} onClick={() => {
    if (!me) {
      const next = window.location.pathname + window.location.search + window.location.hash;
      try { sessionStorage.setItem("meetany.chatReturn", next); } catch {}
      toast("მიწერისთვის შედი ანგარიშში.");
      router.push(`/account/?next=${encodeURIComponent(next)}`);
      return;
    }
    openChat({ companyId, requestId });
  }}><Icon name="message-square"/>მიწერა</button>;
}

export function ChatUnreadLink() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const readCount = store?.unreadMessageCount;
  const [result, setResult] = useState<{ owner: string; count: number } | null>(null);
  useEffect(() => {
    if (!me?.id || me.blocked || !readCount) return;
    let active = true, busy = false, failed = false;
    const update = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const count = await readCount();
        if (active) { setResult({ owner: me.id, count }); failed = false; }
      } catch (err) { if (active && !failed) { toast(errorText(err)); failed = true; } }
      finally { busy = false; }
    };
    void update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("meetany:chat-changed", update);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); window.removeEventListener("meetany:chat-changed", update); document.removeEventListener("visibilitychange", update); };
  }, [me?.id, me?.blocked, readCount]);
  if (!me || me.blocked) return null;
  const count = result && result.owner === me.id ? result.count : 0;
  return <Link className="ma-chat-unread" href="/account/?tab=messages" aria-label={`მიმოწერები${count ? `, ${count} წაუკითხავი` : ""}`}><Icon name="message-square"/>{count ? <span className="ma-chat-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}</Link>;
}

export function ConversationList() {
  const { store } = useMarketStore();
  const list = store?.listConversations;
  const owner = store?.currentUser()?.id;
  const [result, setResult] = useState<{ owner: string; items?: Conversation[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!owner || !list) return;
    let active = true, busy = false;
    const update = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try { const items = await list(); if (active) setResult({ owner, items }); }
      catch (err) { if (active) { const error = errorText(err); setResult({ owner, error }); toast(error); } }
      finally { busy = false; }
    };
    void update();
    const timer = window.setInterval(update, 60000);
    window.addEventListener("meetany:chat-changed", update);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); window.removeEventListener("meetany:chat-changed", update); document.removeEventListener("visibilitychange", update); };
  }, [owner, list, revision]);
  const current = result?.owner === owner ? result : null;
  return <section aria-labelledby="chat-list-title">
    <h1 id="chat-list-title" className="ma-h2">მიმოწერები</h1>
    {!current ? <p role="status">მიმოწერები იტვირთება…</p> : current.error ? <div role="alert"><p>{current.error}</p><button className="ma-btn ma-btn--secondary" onClick={() => setRevision(n => n + 1)}>ხელახლა ცდა</button></div> : current.items?.length ? <ul className="ma-chat-list">{current.items.map(c => {
      const name = c.otherCompany || c.otherName || "მომხმარებელი";
      return <li key={c.id}><button type="button" className="ma-chat-row" onClick={() => openChat({ companyId: c.companyId, conversation: c })}>
        <CompanyAvatar name={name} size="lg"/>
        <span className="ma-chat-row__body"><strong>{name}</strong><span>{c.lastMessage?.body || "დაიწყე საუბარი"}</span>{c.requestId ? <small>მოთხოვნის შესახებ</small> : null}</span>
        <span className="ma-chat-row__meta"><time dateTime={c.lastMessageAt || c.createdAt}>{chatDate(c.lastMessageAt || c.createdAt)}</time>{c.unreadCount ? <span className="ma-chat-badge" aria-label={`${c.unreadCount} წაუკითხავი`}>{c.unreadCount}</span> : null}</span>
      </button></li>;
    })}</ul> : <div className="ma-empty"><Icon name="message-square"/><h2 className="ma-empty__title">მიმოწერა ჯერ არ გაქვს</h2><p>კომპანიის პროფილზე „მიწერა“ საუბარს გახსნის.</p><Link className="ma-btn ma-btn--secondary" href="/companies/">კომპანიების ნახვა</Link></div>}
  </section>;
}

export function ChatPopup() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const [selection, setSelection] = useState<{ owner: string; target: ChatTarget; key: number } | null>(null);
  const serial = useRef(0);
  useEffect(() => {
    if (!me?.id || me.blocked) return;
    const open = (event: Event) => {
      const target = (event as CustomEvent<ChatTarget>).detail;
      if (target?.companyId) setSelection({ owner: me.id, target, key: ++serial.current });
    };
    window.addEventListener("meetany:chat-open", open);
    return () => window.removeEventListener("meetany:chat-open", open);
  }, [me?.id, me?.blocked]);
  if (!store || !me || me.blocked || !selection || selection.owner !== me.id) return null;
  return <ChatWindow key={selection.key} store={store} owner={me.id} target={selection.target} onClose={() => setSelection(null)}/>;
}

function ChatWindow({ store, owner, target, onClose }: { store: Store; owner: string; target: ChatTarget; onClose: () => void }) {
  const { startConversation, listConversations, listMessages, markRead } = store;
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const alive = useRef(true);
  const sending = useRef(false);
  const [conversation, setConversation] = useState<Conversation | null>(target.conversation || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState("");
  const name = conversation?.otherCompany || conversation?.otherName || store.userById(target.companyId)?.company || "მიმოწერა";
  const merge = (incoming: Message[]) => setMessages(old => [...new Map([...old, ...incoming].map(m => [m.id, m])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  useEffect(() => {
    alive.current = true;
    const node = dialog.current!;
    const opener = document.activeElement as HTMLElement | null;
    const media = matchMedia("(max-width:767px)");
    const sync = () => {
      node.close();
      if (media.matches) node.showModal(); else node.show();
    };
    sync();
    input.current?.focus({ preventScroll: true });
    media.addEventListener("change", sync);
    return () => { alive.current = false; media.removeEventListener("change", sync); node.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
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
          changed();
        }
        const incoming: Message[] = await listMessages(id, after);
        if (!active) return;
        merge(incoming);
        // Advance only from the ordered fetch, never from a send response: a peer's
        // message may have committed between our last poll and our own send.
        if (incoming.length) after = incoming[incoming.length - 1].createdAt;
        setLoaded(true); setFailed(false);
        if (!document.hidden) { const result = await markRead(id); if (active && result.marked) changed(); }
        hadError = false;
      } catch (err) {
        if (active) { setFailed(true); if (!hadError) toast(errorText(err)); hadError = true; }
      } finally { busy = false; }
    };
    void update();
    const timer = window.setInterval(update, 5000);
    document.addEventListener("visibilitychange", update);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [startConversation, listConversations, listMessages, markRead, target, revision]);
  useEffect(() => {
    if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send() {
    if (!conversation || !loaded || sending.current || !body.trim() || body.length > 2000) return;
    sending.current = true; setPending(true); setSendError("");
    try {
      const message: Message = await store.sendMessage(conversation.id, body.trim());
      if (!alive.current) return;
      atBottom.current = true; merge([message]); setBody(""); changed(); input.current?.focus();
    } catch (err) { if (alive.current) { const error = (err as { userMessage?: string })?.userMessage || "შეტყობინება ვერ გაიგზავნა. სცადე ხელახლა."; setSendError(error); toast(error); } }
    finally { sending.current = false; if (alive.current) setPending(false); }
  }
  return <dialog ref={dialog} className="ma-chat" aria-labelledby="ma-chat-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <header className="ma-chat__head"><CompanyAvatar name={name}/><div><h2 id="ma-chat-title">{name}</h2><span>{conversation?.requestId || target.requestId ? "მოთხოვნის შესახებ" : "პირადი მიმოწერა"}</span></div><button type="button" className="ma-chat__close" aria-label="მიმოწერის დახურვა" onClick={onClose}><Icon name="x"/></button></header>
    <div className="ma-chat__messages" ref={scroll} onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}>
      {!loaded ? <p role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p> : !messages.length ? <div className="ma-chat__empty"><Icon name="message-square"/><h3>დაიწყე საუბარი</h3><p>მოიკითხე დეტალები და შეთანხმდით თანამშრომლობაზე.</p></div> : messages.map(m => <div key={m.id} className={`ma-chat__message${m.senderId === owner ? " ma-chat__message--mine" : ""}`}><span className="ma-sr-only">{m.senderId === owner ? "შენ" : name}: </span><p>{m.body}</p><time dateTime={m.createdAt}>{chatDate(m.createdAt)}</time></div>)}
    </div>
    {failed ? <div className="ma-chat__retry"><span>განახლება ვერ მოხერხდა.</span><button className="ma-link" onClick={() => setRevision(n => n + 1)}>ხელახლა ცდა</button></div> : null}
    <form className="ma-chat__composer" onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="ma-sr-only" htmlFor="ma-chat-body">შეტყობინება</label>
      <textarea ref={input} id="ma-chat-body" className="ma-textarea" rows={2} maxLength={2000} value={body} readOnly={pending} aria-describedby="ma-chat-count" placeholder="დაწერე შეტყობინება…" onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
      {sendError ? <p className="ma-field__error" role="alert">{sendError}</p> : null}
      <div className="ma-chat__composer-foot"><span id="ma-chat-count">{body.length} / 2000</span><button className="ma-btn ma-btn--primary" type="submit" disabled={!loaded || !body.trim() || pending}>{pending ? "იგზავნება…" : "გაგზავნა"}<Icon name="send"/></button></div>
    </form>
  </dialog>;
}
