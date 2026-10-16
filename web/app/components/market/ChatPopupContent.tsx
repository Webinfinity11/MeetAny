"use client";
import { ChatContext, ChatMessages, ChatTools } from "./messaging/ChatParts";
import { SharedFiles } from "./messaging/SharedFiles";
import { Button } from "../ui/Button";


import { trapDialogFocus } from "../ui/dialog-focus";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type Store } from "../../lib/market-client";
import { useChatDraft, useChatThread, useConversationList, useUnreadMessageCount, type ChatTarget, type Conversation } from "../../lib/chat-client";
import { CompanyAvatar } from "./CompanyAvatar";
import { Icon } from "../Icon";
import styles from "./ChatPopup.module.css";

/** A small decorative cue leaves the empty conversation readable at any viewport height. */
function EmptyConversationArt() {
  return <span className={styles.emptyArt} aria-hidden="true"><Icon name="message-square"/></span>;
}
export function ChatPopupContent({ store, owner, role, initial }: { store: Store; owner: string; role: string; initial: { target?: ChatTarget } }) {
  const [selection, setSelection] = useState<{ target: ChatTarget; key: number } | null>(() => initial.target ? { target: initial.target, key: 0 } : null);
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<"list" | "thread">(initial.target ? "thread" : "list");
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
    {selection ? <button type="button" className="ma-chat-launcher" aria-label={`${expanded ? "ჩატის დახურვა" : "ჩატის გახსნა"}${unread ? `, ${unread} წაუკითხავი` : ""}`} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><Icon name="message-square" /><span className="ma-chat-launcher__dots" aria-hidden="true"><i/><i/><i/></span>{unread ? <span className="ma-chat-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}</button> : null}
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
    <div className="ma-chat__head"><div><h2 id="ma-chat-list-title">მიმოწერები</h2><span>ყველა საუბარი ერთ სივრცეში</span></div><button type="button" className="ma-chat__close" aria-label="მიმოწერის ჩაკეცვა" onClick={onClose}><Icon name="x" /></button></div>
    <nav className={styles.threadTabs} aria-label="მიმოწერის ხედი"><span aria-current="page"><Icon name="message-square"/>ყველა საუბარი</span><Link href="/account/?tab=messages" onClick={onClose}><Icon name="external-link"/>სრულად გახსნა</Link></nav>
    <div className="ma-chat-list" aria-busy={!current}>
      {!current ? <p className="ma-chat-list__note" role="status">მიმოწერები იტვირთება…</p> : current.error && !current.items ? <div className="ma-chat-list__note" role="alert"><p>მიმოწერები ვერ ჩაიტვირთა.</p><Button type="button" variant="secondary" onClick={retry}>ხელახლა ცდა</Button></div> : !current.items?.length ? <div className="ma-chat-list__note"><p>მიმოწერები ჯერ არ გაქვთ.</p><Button variant="secondary" href={role === "company" ? "/requests/" : "/companies/"}><Icon name={role === "company" ? "clipboard-list" : "building-2"} />{role === "company" ? "მოთხოვნების ნახვა" : "კომპანიების ნახვა"}</Button></div> : <ul>{current.items.map((c: Conversation) => {
        const other = c.otherId || (c.clientId === owner ? c.companyId : c.clientId);
        const name = c.otherCompany || c.otherName || "მომხმარებელი";
        const requestId = c.requestId || (c.contextKey && c.contextKey !== "general" ? c.contextKey : null);
        const context = requestId ? store.getRequest(requestId)?.title || "მოთხოვნის შესახებ" : "პირადი მიმოწერა";
        return <li key={c.id}><button type="button" className="ma-chat-list__row" data-unread={c.unreadCount > 0 || undefined} onClick={() => onSelect({ companyId: c.companyId, requestId: c.requestId || undefined, conversation: c })}>
          <CompanyAvatar name={name} logoUrl={store.userById(other)?.logoUrl} />
          <span className="ma-chat-list__text"><strong>{name}</strong><small>{context}</small><span>{c.lastMessage ? `${c.lastMessage.senderId === owner ? "თქვენ: " : ""}${c.lastMessage.body}` : "შეტყობინება ჯერ არ არის"}</span></span>
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
  const [body, setBody] = useChatDraft(owner, target);
  const [validationError, setValidationError] = useState("");
  const otherId = conversation?.otherId || (conversation ? (conversation.clientId === owner ? conversation.companyId : conversation.clientId) : target.companyId !== owner ? target.companyId : "");
  const peer = store.userById(otherId);
  const logoUrl = peer?.logoUrl;
  const name = conversation?.otherCompany || conversation?.otherName || peer?.company || peer?.name || "მიმოწერა";
  const isCompany = (peer?.role || conversation?.otherRole) === "company";
  const requestId = conversation?.requestId || (conversation?.contextKey && conversation.contextKey !== "general" ? conversation.contextKey : null) || target.requestId;
  const [now] = useState(() => Date.now());
  const lastSent = messages.findLast(message => message.senderId === owner);
  useEffect(() => {
    if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  async function send() {
    if (pending) return;
    if (!body.trim()) { setValidationError("დაწერეთ შეტყობინება"); input.current?.focus(); return; }
    if (!loaded) { setValidationError("საუბარი ჯერ არ ჩატვირთულა. სცადეთ ხელახლა."); return; }
    setValidationError("");
    if (await deliver(body, () => { atBottom.current = true; })) { setBody(""); if (dialog.current?.open) input.current?.focus(); }
  }
  return <dialog ref={dialog} className={`ma-chat ma-chat--dock ${styles.dock}`} aria-labelledby="ma-chat-title" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => { if (e.currentTarget.matches(":modal")) trapDialogFocus(e); if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
    <div className={`ma-chat__head ${styles.threadHead}`}>
      <div className={styles.threadIdentity}><CompanyAvatar name={name} logoUrl={logoUrl}/><h2 id="ma-chat-title" title={name}>{isCompany ? <Link className="ma-chat__peer-link" href={`/companies/view/?id=${encodeURIComponent(otherId)}`} onClick={onClose}>{name}</Link> : name}</h2></div>
      {conversation ? <ChatTools conversationId={conversation.id}/> : null}
      <button type="button" className="ma-chat__close" aria-label="მიმოწერის ჩაკეცვა" title="მიმოწერის ჩაკეცვა" onClick={onClose}><Icon name="x"/></button>
    </div>
    <nav className={styles.threadTabs} aria-label="მიმოწერის ხედი"><button type="button" onClick={onBack}><Icon name="chevron-left"/>ყველა საუბარი</button>{conversation ? <Link href={`/account/?tab=messages&c=${encodeURIComponent(conversation.id)}`} onClick={onClose}><Icon name="external-link"/>სრულად გახსნა</Link> : null}</nav>
    <div className={styles.contextArea}><ChatContext store={store} requestId={requestId} companyId={conversation?.companyId || target.companyId} collapsible disclosureGroup={conversation ? `popup-${conversation.id}` : undefined}/></div>
    <div className="ma-chat__messages" tabIndex={0} ref={scroll} onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}>
      {!loaded ? <p role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p> : !messages.length ? <div className="ma-chat__empty"><EmptyConversationArt /><h3>დაიწყეთ საუბარი</h3><p>მოიკითხეთ დეტალები და შეთანხმდით თანამშრომლობაზე.</p></div> : <ChatMessages messages={messages} owner={owner} name={name} now={now}/>}
    </div>
    {lastSent ? <small className="ma-note" role="status">ბოლო შეტყობინება · {lastSent.readAt ? "წაკითხულია" : "გაგზავნილია"}</small> : null}
    {failed ? <div className="ma-chat__retry"><span>განახლება ვერ მოხერხდა.</span><button className="ma-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
    {conversation && visible ? <SharedFiles store={store} target={conversation.id} disclosureGroup={`popup-${conversation.id}`}/> : null}
    <form className="ma-chat__composer" onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="ma-sr-only" htmlFor="ma-chat-body">შეტყობინება</label>
      <textarea ref={input} id="ma-chat-body" className="ma-textarea" rows={1} maxLength={2000} value={body} readOnly={pending} aria-invalid={!!(validationError || sendError)} aria-describedby={validationError || sendError ? "ma-chat-error" : undefined} placeholder="დაწერეთ შეტყობინება…" onChange={e => { setBody(e.target.value); setValidationError(""); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
      {validationError || sendError ? <p id="ma-chat-error" className="ma-field__error" role="alert">{validationError || sendError}</p> : null}
      <div className="ma-chat__composer-foot"><Button variant="primary" type="submit" disabled={pending}><Icon name="send"/><span>{pending ? "იგზავნება…" : "გაგზავნა"}</span></Button></div>
    </form>
  </dialog>;
}
