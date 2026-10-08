"use client";
import { ChatContext, ChatMessages } from "./messaging/ChatParts";
import { Button } from "../ui/Button";


import { trapDialogFocus } from "../ui/dialog-focus";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useChatThread, useConversationList, useUnreadMessageCount, type ChatTarget, type Conversation } from "../../lib/chat-client";
import { CompanyAvatar } from "./CompanyAvatar";
import { Icon } from "../Icon";
import { toast } from "../Toasts";
import styles from "./ChatPopup.module.css";

export type { Conversation } from "../../lib/chat-client";
export const chatDate = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
};

/** Decorative invitation for a genuinely empty thread; never a peer's typing or presence state. */
function EmptyConversationArt() {
  return <span className={styles.emptyArt} aria-hidden="true">
    <Image className={styles.illustration} src="/assets/chat-conversation-v1.png" width={1536} height={1024} sizes="216px" alt="" />
  </span>;
}
export function openChat(target: ChatTarget) {
  window.dispatchEvent(new CustomEvent("meetany:chat-open", { detail: target }));
}

/** True once the stored session has been checked; before that a signed-in user must not be drawn as a guest. */
export function useSessionReady(store: { ready?: () => Promise<unknown> } | null | undefined) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    if (store?.ready) store.ready().then(() => { if (active) setDone(true); }, () => { if (active) setDone(true); });
    return () => { active = false; };
  }, [store]);
  return done;
}

export function MessageButton({ companyId, requestId, variant = "secondary" }: { companyId: string; requestId?: string; variant?: "secondary" | "ghost" }) {
  const { store, ready } = useMarketStore();
  const router = useRouter();
  const sessionReady = useSessionReady(store);
  const me = ready && sessionReady ? store?.currentUser() : null;
  if (me?.role === "admin" || (me?.id === companyId && !requestId)) return null;
  return <Button type="button" variant={variant} disabled={!ready || !sessionReady || !!me?.blocked} onClick={() => {
    if (!me) {
      const next = window.location.pathname + window.location.search + window.location.hash;
      toast("მიწერისთვის შედი ანგარიშში.");
      router.push(`/account/?next=${encodeURIComponent(next)}`);
      return;
    }
    openChat({ companyId, requestId });
  }}><Icon name={me || !sessionReady ? "message-square" : "user-round"}/>{me || !sessionReady ? "მიწერა" : "შედი ანგარიშში და მიწერე"}</Button>;
}

export function ChatUnreadLink() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked);
  if (!me || me.blocked) return null;
  const count = unread ?? 0;
  return <button type="button" className="ma-chat-unread" onClick={() => window.dispatchEvent(new Event("meetany:chat-list"))} aria-label={`მიმოწერები${count ? `, ${count} წაუკითხავი` : ""}`}><Icon name="message-square"/>{count ? <span className="ma-chat-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}</button>;
}

export function ChatPopup() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  if (!store || !me || me.blocked || me.role === "admin") return null;
  return <ChatDock key={me.id} store={store} owner={me.id} role={me.role} />;
}

function ChatDock({ store, owner, role }: { store: Store; owner: string; role: string }) {
  const [selection, setSelection] = useState<{ target: ChatTarget; key: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"list" | "thread">("list");
  const unread = useUnreadMessageCount(store, owner) ?? 0;
  const serial = useRef(0);
  const choose = (target: ChatTarget) => {
    setSelection(previous => previous && previous.target.companyId === target.companyId && previous.target.requestId === target.requestId && previous.target.conversation?.id === target.conversation?.id
      ? previous : { target, key: ++serial.current });
    setView("thread"); setExpanded(true);
  };
  useEffect(() => {
    const open = (event: Event) => {
      const target = (event as CustomEvent<ChatTarget>).detail;
      if (target?.companyId) {
        setSelection({ target, key: ++serial.current });
        setView("thread"); setExpanded(true);
      }
    };
    const list = () => { setView("list"); setExpanded(true); };
    window.addEventListener("meetany:chat-open", open);
    window.addEventListener("meetany:chat-list", list);
    return () => { window.removeEventListener("meetany:chat-open", open); window.removeEventListener("meetany:chat-list", list); };
  }, []);
  return <>
    {selection ? <button type="button" className="ma-chat-launcher" aria-label={`მიმოწერა${unread ? `, ${unread} წაუკითხავი` : ""}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Icon name="message-square" /><span>მიმოწერა</span>{unread ? <span className="ma-chat-badge">{unread > 99 ? "99+" : unread}</span> : null}</button> : null}
    {expanded && view === "list" ? <ChatList store={store} owner={owner} role={role} onSelect={choose} onClose={() => setExpanded(false)} /> : null}
    {selection ? <ChatWindow key={selection.key} store={store} owner={owner} target={selection.target} visible={expanded && view === "thread"} onBack={() => setView("list")} onClose={() => setExpanded(false)} /> : null}
  </>;
}

/** Nonmodal on desktop; a focused full-screen dialog on phones, including the keyboard viewport. */
function useChatDialog(visible: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!visible || !dialog.current) return;
    const node = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    const media = matchMedia("(max-width:767px)");
    const viewport = window.visualViewport;
    const fit = () => {
      node.style.setProperty("--chat-viewport-height", `${viewport?.height || innerHeight}px`);
      node.style.setProperty("--chat-viewport-top", `${viewport?.offsetTop || 0}px`);
    };
    const sync = () => { node.close(); if (media.matches) node.showModal(); else node.show(); fit(); };
    sync();
    // Do not summon the phone keyboard before the user chooses to type.
    node.querySelector<HTMLElement>(".ma-chat__close")?.focus({ preventScroll: true });
    media.addEventListener("change", sync);
    viewport?.addEventListener("resize", fit); viewport?.addEventListener("scroll", fit);
    return () => {
      media.removeEventListener("change", sync); viewport?.removeEventListener("resize", fit); viewport?.removeEventListener("scroll", fit);
      node.close(); if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [visible]);
  return dialog;
}

function ChatList({ store, owner, role, onSelect, onClose }: { store: Store; owner: string; role: string; onSelect: (target: ChatTarget) => void; onClose: () => void }) {
  const dialog = useChatDialog(true);
  const { current, retry } = useConversationList(store, owner);
  return <dialog ref={dialog} className={`ma-chat ma-chat--dock ${styles.dock}`} aria-labelledby="ma-chat-list-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.currentTarget.matches(":modal")) trapDialogFocus(e); if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <header className="ma-chat__head"><div><h2 id="ma-chat-list-title">მიმოწერები</h2><span>ყველა საუბარი ერთ სივრცეში</span></div><Link className="ma-chat__close" href="/account/?tab=messages" onClick={onClose} aria-label="მიმოწერების სრულად გახსნა"><Icon name="layout-grid" /></Link><button type="button" className="ma-chat__close" aria-label="მიმოწერის ჩაკეცვა" onClick={onClose}><Icon name="x" /></button></header>
    <div className="ma-chat-list" aria-busy={!current}>
      {!current ? <p className="ma-chat-list__note" role="status">მიმოწერები იტვირთება…</p> : current.error && !current.items ? <div className="ma-chat-list__note" role="alert"><p>მიმოწერები ვერ ჩაიტვირთა.</p><Button type="button" variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div> : !current.items?.length ? <div className="ma-chat-list__note"><p>მიმოწერა ჯერ არ გაქვს.</p><Button variant="secondary" href={role === "company" ? "/requests/" : "/companies/"}><Icon name={role === "company" ? "clipboard-list" : "building-2"} />{role === "company" ? "მოთხოვნების ნახვა" : "კომპანიების ნახვა"}</Button></div> : <ul>{current.items.map((c: Conversation) => {
        const other = c.otherId || (c.clientId === owner ? c.companyId : c.clientId);
        const name = c.otherCompany || c.otherName || "მომხმარებელი";
        const requestId = c.requestId || (c.contextKey && c.contextKey !== "general" ? c.contextKey : null);
        const context = requestId ? store.getRequest(requestId)?.title || "მოთხოვნის შესახებ" : "პირადი მიმოწერა";
        return <li key={c.id}><button type="button" className="ma-chat-list__row" data-unread={c.unreadCount > 0 || undefined} onClick={() => onSelect({ companyId: c.companyId, requestId: c.requestId || undefined, conversation: c })}>
          <CompanyAvatar name={name} logoUrl={store.userById(other)?.logoUrl} />
          <span className="ma-chat-list__text"><strong>{name}</strong><small>{context}</small><span>{c.lastMessage ? `${c.lastMessage.senderId === owner ? "შენ: " : ""}${c.lastMessage.body}` : "შეტყობინება ჯერ არ არის"}</span></span>
          {c.unreadCount > 0 ? <span className="ma-chat-badge" aria-label={`${c.unreadCount} წაუკითხავი`}>{c.unreadCount > 99 ? "99+" : c.unreadCount}</span> : null}
        </button></li>;
      })}</ul>}
    </div>
    {current?.error && current.items ? <div className="ma-chat__retry" role="alert"><span>განახლება ვერ მოხერხდა.</span><button type="button" className="ma-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
  </dialog>;
}

function ChatWindow({ store, owner, target, visible, onBack, onClose }: { store: Store; owner: string; target: ChatTarget; visible: boolean; onBack: () => void; onClose: () => void }) {
  const dialog = useChatDialog(visible);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const { conversation, messages, loaded, failed, pending, sendError, send: deliver, retry } = useChatThread(store, target, visible);
  const [body, setBody] = useState("");
  const otherId = conversation?.otherId || (conversation ? (conversation.clientId === owner ? conversation.companyId : conversation.clientId) : target.companyId !== owner ? target.companyId : "");
  const peer = store.userById(otherId);
  const logoUrl = peer?.logoUrl;
  const name = conversation?.otherCompany || conversation?.otherName || peer?.company || peer?.name || "მიმოწერა";
  const isCompany = peer?.role === "company" || otherId === (conversation?.companyId || target.companyId);
  const requestId = conversation?.requestId || (conversation?.contextKey && conversation.contextKey !== "general" ? conversation.contextKey : null) || target.requestId;
  const [now] = useState(() => Date.now());
  useEffect(() => {
    if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send() {
    if (await deliver(body, () => { atBottom.current = true; })) { setBody(""); if (dialog.current?.open) input.current?.focus(); }
  }
  return <dialog ref={dialog} className={`ma-chat ma-chat--dock ${styles.dock}`} aria-labelledby="ma-chat-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.currentTarget.matches(":modal")) trapDialogFocus(e); if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <header className={`ma-chat__head ${styles.threadHead}`}>
      <div className={styles.threadIdentity}><CompanyAvatar name={name} logoUrl={logoUrl}/><h2 id="ma-chat-title" title={name}>{isCompany ? <Link className="ma-chat__peer-link" href={`/companies/view/?id=${encodeURIComponent(otherId)}`} onClick={onClose}>{name}</Link> : name}</h2></div>
      <button type="button" className="ma-chat__close" aria-label="მიმოწერის ჩაკეცვა" title="მიმოწერის ჩაკეცვა" onClick={onClose}><Icon name="x"/></button>
      <div className={styles.threadContext}>
        <button type="button" className="ma-chat__close" aria-label="ყველა მიმოწერა" title="ყველა მიმოწერა" onClick={onBack}><Icon name="message-square" /></button>

        {conversation ? <Link className="ma-chat__close" href={`/account/?tab=messages&c=${encodeURIComponent(conversation.id)}`} onClick={onClose} aria-label="მიმოწერის სრულად გახსნა" title="მიმოწერის სრულად გახსნა"><Icon name="layout-grid" /></Link> : null}
      </div>
    </header>
    <ChatContext store={store} requestId={requestId} companyId={conversation?.companyId || target.companyId}/>
    <div className="ma-chat__messages" ref={scroll} onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}>
      {!loaded ? <p role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p> : !messages.length ? <div className="ma-chat__empty"><EmptyConversationArt /><h3>დაიწყე საუბარი</h3><p>მოიკითხე დეტალები და შეთანხმდით თანამშრომლობაზე.</p></div> : <ChatMessages messages={messages} owner={owner} name={name} now={now}/>}
    </div>
    {failed ? <div className="ma-chat__retry"><span>განახლება ვერ მოხერხდა.</span><button className="ma-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
    <form className="ma-chat__composer" onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="ma-sr-only" htmlFor="ma-chat-body">შეტყობინება</label>
      <textarea ref={input} id="ma-chat-body" className="ma-textarea" rows={1} maxLength={2000} value={body} readOnly={pending} placeholder="დაწერე შეტყობინება…" onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
      {sendError ? <p className="ma-field__error" role="alert">{sendError}</p> : null}
      <div className="ma-chat__composer-foot"><Button variant="primary" type="submit" disabled={!loaded || !body.trim() || pending}><span>{pending ? "იგზავნება…" : "გაგზავნა"}</span></Button></div>
    </form>
  </dialog>;
}
