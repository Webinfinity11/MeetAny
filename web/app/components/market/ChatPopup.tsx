"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useChatThread, useUnreadMessageCount, type ChatTarget } from "../../lib/chat-client";
import { CompanyAvatar } from "./CompanyAvatar";
import { Icon } from "../Icon";
import { toast } from "../Toasts";

export type { Conversation } from "../../lib/chat-client";
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
      toast("მიწერისთვის შედი ანგარიშში.");
      router.push(`/account/?next=${encodeURIComponent(next)}`);
      return;
    }
    openChat({ companyId, requestId });
  }}><Icon name={me ? "message-square" : "user-round"}/>{me ? "მიწერა" : "შედი ანგარიშში და მიწერე"}</button>;
}

export function ChatUnreadLink() {
  const { store, ready } = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked);
  if (!me || me.blocked) return null;
  const count = unread ?? 0;
  return <Link className="ma-chat-unread" href="/account/?tab=messages" aria-label={`მიმოწერები${count ? `, ${count} წაუკითხავი` : ""}`}><Icon name="message-square"/>{count ? <span className="ma-chat-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}</Link>;
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
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const { conversation, messages, loaded, failed, pending, sendError, send: deliver, retry } = useChatThread(store, target);
  const [body, setBody] = useState("");
  const otherId = conversation?.otherId || (conversation ? (conversation.clientId === owner ? conversation.companyId : conversation.clientId) : target.companyId);
  const logoUrl = store.userById(otherId)?.logoUrl;
  const name = conversation?.otherCompany || conversation?.otherName || store.userById(target.companyId)?.company || "მიმოწერა";
  useEffect(() => {
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
    return () => { media.removeEventListener("change", sync); node.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send() {
    if (await deliver(body, () => { atBottom.current = true; })) { setBody(""); input.current?.focus(); }
  }
  return <dialog ref={dialog} className="ma-chat" aria-labelledby="ma-chat-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <header className="ma-chat__head"><CompanyAvatar name={name} logoUrl={logoUrl}/><div><h2 id="ma-chat-title">{name}</h2><span>{conversation?.requestId || target.requestId ? "მოთხოვნის შესახებ" : "პირადი მიმოწერა"}</span></div><button type="button" className="ma-chat__close" aria-label="მიმოწერის დახურვა" onClick={onClose}><Icon name="x"/></button></header>
    <div className="ma-chat__messages" ref={scroll} onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}>
      {!loaded ? <p role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p> : !messages.length ? <div className="ma-chat__empty"><Icon name="message-square"/><h3>დაიწყე საუბარი</h3><p>მოიკითხე დეტალები და შეთანხმდით თანამშრომლობაზე.</p></div> : messages.map(m => <div key={m.id} className={`ma-chat__message${m.senderId === owner ? " ma-chat__message--mine" : ""}`}><span className="ma-sr-only">{m.senderId === owner ? "შენ" : name}: </span><p>{m.body}</p><time dateTime={m.createdAt}>{chatDate(m.createdAt)}</time></div>)}
    </div>
    {failed ? <div className="ma-chat__retry"><span>განახლება ვერ მოხერხდა.</span><button className="ma-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
    <form className="ma-chat__composer" onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="ma-sr-only" htmlFor="ma-chat-body">შეტყობინება</label>
      <textarea ref={input} id="ma-chat-body" className="ma-textarea" rows={2} maxLength={2000} value={body} readOnly={pending} aria-describedby="ma-chat-count" placeholder="დაწერე შეტყობინება…" onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
      {sendError ? <p className="ma-field__error" role="alert">{sendError}</p> : null}
      <div className="ma-chat__composer-foot"><span id="ma-chat-count">{body.length} / 2000</span><button className="ma-btn ma-btn--primary" type="submit" disabled={!loaded || !body.trim() || pending}>{pending ? "იგზავნება…" : "გაგზავნა"}<Icon name="send"/></button></div>
    </form>
  </dialog>;
}
