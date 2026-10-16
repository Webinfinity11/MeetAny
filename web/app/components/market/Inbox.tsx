"use client";
import { Button } from "../ui/Button";


import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatContext, ChatMessages, ChatTools } from "./messaging/ChatParts";
import { CompanyAvatar } from "./CompanyAvatar";
import { EmptyState } from "../ui/Structure";
import { Notice } from "../ui/Notice";
import { dateShort } from "../../lib/format";
import { SharedFiles } from "./messaging/SharedFiles";
import styles from "./engagement.module.css";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import type { Store } from "../../lib/market-client";
import { useChatDraft, useChatThread, useConversationList, type Conversation } from "../../lib/chat-client";
import { categories } from "../../lib/categories";
import { usePublicPhone } from "../../lib/phones";
import { Icon } from "../Icon";
import { trapDialogFocus } from "../ui/dialog-focus";

type Me = { id: string; role: string };
type Profile = { logoUrl?: string | null; role?: string; industry?: string; verified?: boolean } | null;
const WIDE = "(min-width:768px)";
const DAY = 86400000;

// Calendar days and clock times in Tbilisi, whatever the viewer's zone.
const dayKey = (value: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const daysAgo = (value: string, now: number) => Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(value))) / DAY);
function rowTime(value: string, now: number) {
  const days = daysAgo(value, now);
  return days <= 0 ? clock(value) : days === 1 ? "გუშინ" : days < 7 ? `${days} დღის წინ` : dateShort(dayKey(value));
}

function useWide() {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const media = matchMedia(WIDE);
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** Who the conversation is with and what it is about, from the public cache. */
function describe(store: Store, me: Me, c: Conversation) {
  const otherId = c.otherId || (c.clientId === me.id ? c.companyId : c.clientId);
  const profile = store.userById(otherId) as Profile;
  const name = c.otherCompany || c.otherName || "მომხმარებელი";
  // context_key carries the request id even when the list returns request_id empty.
  const requestId = c.requestId || (c.contextKey && c.contextKey !== "general" ? c.contextKey : null);
  const request = requestId ? (store.getRequest(requestId) as { title?: string } | null) : null;
  const isCompany = (profile?.role || c.otherRole) === "company";
  const context = requestId ? request?.title || "მოთხოვნის შესახებ" : isCompany && profile?.industry ? categories[profile.industry] || profile.industry : "პირადი მიმოწერა";
  return { otherId, name, logoUrl: profile?.logoUrl, verified: profile?.verified, context, isCompany, requestId, requestFound: !!request };
}

export function Inbox({ store, me, space = "buy" }: { store: Store; me: Me; space?: "buy" | "sell" }) {
  const { current, retry } = useConversationList(store, me.id);
  const wide = useWide();
  const params = useSearchParams();
  // ?tab=messages&c=<id> opens one conversation directly.
  const query = params.get("c");
  const [selection, setSelection] = useState(() => ({ query, id: query }));
  const selected = selection.query === query ? selection.id : query;
  const opener = useRef<HTMLButtonElement | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const items = current?.items;
  const visibleItems = items?.filter(c => { const d = describe(store, me, c); return `${d.name} ${d.context} ${c.lastMessage?.body || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()); });
  // Relative times ("14:20", "გუშინ") stay right across midnight.
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  // Desktop opens the newest conversation; mobile starts on the list.
  const active = items?.find(c => c.id === selected) || (wide && items?.length ? items[0] : null);
  const backToList = () => {
    const trigger = opener.current || document.querySelector<HTMLButtonElement>(`[data-conversations] li[data-id="${active?.id}"] button`);
    setSelection({ query, id: null });
    requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
  };

  if (!current) return <div role="status" aria-busy="true" className={styles.emptyState}>მიმოწერები იტვირთება…</div>;
  if (current.error && !items) return <Notice tone="error" action={<Button variant="secondary" size="sm" onClick={retry}>ხელახლა ცდა</Button>}>{current.error}</Notice>;
  if (!items?.length) return space === "sell"
    ? <EmptyState icon="message-square" title="მიმოწერები ჯერ არ არის" text="საუბარი იწყება, როცა შეთავაზებას გაგზავნით ან კლიენტი მოგწერთ." action={<Button variant="secondary" href="/matching/"><Icon name="inbox"/>შესაძლებლობების ნახვა</Button>}/>
    : <EmptyState icon="message-square" title="მიმოწერები ჯერ არ არის" text="საუბარი იწყება, როცა კომპანიას მისწერთ ან შეთავაზებას მიიღებთ." action={<Button variant="secondary" href="/companies/"><Icon name="search"/>კომპანიების ძიება</Button>}/>;

  return <section className={styles.inboxRoot}><div className={styles["inbox"]} data-view={active && !wide ? "thread" : "list"} aria-label="მიმოწერები">
    <div className={styles["inbox-list"]} data-conversations>
      <label className={styles.chatSearch}><Icon name="search"/><span className="ma-sr-only">საუბრის ძიება</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ძიება"/></label>
      <ul>
        {visibleItems?.map(c => {
          const d = describe(store, me, c);
          const last = c.lastMessage;
          const unread = c.unreadCount > 0;
          return <li key={c.id} data-id={c.id} data-context={d.requestId ? "request" : "general"}>
            <button type="button" className={styles["inbox-row"]} aria-current={c.id === active?.id ? "true" : undefined} data-unread={unread || undefined} onClick={event => { opener.current = event.currentTarget; setSelection({ query, id: c.id }); }}>
              <CompanyAvatar name={d.name} logoUrl={d.logoUrl}/>
              <span className={styles["inbox-row__text"]}>
                <span className={styles["inbox-row__top"]}>
                  <span className={styles["inbox-row__name"]}>{d.name}{d.verified ? <span title="ვერიფიცირებული"><Icon name="badge-check"/></span> : null}{unread ? <span className="ma-sr-only">, წაუკითხავი</span> : null}</span>
                  <span className={styles.rowMeta}><time dateTime={c.lastMessageAt || c.createdAt}>{rowTime(c.lastMessageAt || c.createdAt, now)}</time>{unread ? <span className={styles.unreadCount}>{c.unreadCount}</span> : null}</span>
                </span>
                <span className={styles["inbox-row__context"]}>{d.context}</span>
                <span className={styles["inbox-row__preview"]}>{last ? `${last.senderId === me.id ? "თქვენ: " : ""}${last.body}` : "შეტყობინება ჯერ არ არის"}</span>
              </span>
            </button>
          </li>;
        })}
      </ul>
      {!visibleItems?.length ? <p className={styles["inbox-note"]} role="status">საუბარი ვერ მოიძებნა.</p> : null}
    </div>
    {active ? <Thread key={active.id} store={store} me={me} conversation={active} wide={!!wide} onBack={backToList}/> : wide === false ? null : <div className={styles["inbox-thread"] + " " + styles["inbox-thread--none"]}/>}
  </div></section>;
}

function Thread({ store, me, conversation, wide, onBack }: { store: Store; me: Me; conversation: Conversation; wide: boolean; onBack: () => void }) {
  // The target is fixed per opened conversation so list refreshes do not restart polling.
  const [target] = useState(() => ({ companyId: conversation.companyId, conversation }));
  const { messages, loaded, failed, pending, sendError, send, retry } = useChatThread(store, target);
  const d = describe(store, me, conversation);
  // Public company phone only (same projection as the profile page); clients have none.
  const phone = usePublicPhone(store, d.isCompany ? d.otherId : undefined);
  const [body, setBody] = useChatDraft(me.id, target);
  const [validationError, setValidationError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const [now] = useState(() => Date.now());
  const back = useRef<HTMLButtonElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (wide) return;
    const viewport = window.visualViewport;
    const fit = () => paneRef.current?.style.setProperty("--inbox-viewport-height", `${viewport?.height || innerHeight}px`);
    fit();
    viewport?.addEventListener("resize", fit);
    return () => viewport?.removeEventListener("resize", fit);
  }, [wide]);

  // On the mobile sheet focus lands on the way back.
  useEffect(() => { if (!wide) back.current?.focus({ preventScroll: true }); }, [wide]);
  useLayoutEffect(() => {
    if (atBottom.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  async function submit() {
    if (pending) return;
    if (!body.trim()) { setValidationError("დაწერეთ შეტყობინება"); input.current?.focus(); return; }
    if (!loaded) { setValidationError("საუბარი ჯერ არ ჩატვირთულა. სცადეთ ხელახლა."); return; }
    setValidationError("");
    if (await send(body, () => { atBottom.current = true; })) { setBody(""); input.current?.focus(); }
  }
  const sheet = !wide;
  const pane = <div ref={paneRef} className={`${styles["inbox-thread"]} ${sheet ? styles["inbox-thread--sheet"] : ""}`} role={sheet ? "dialog" : undefined} aria-modal={sheet ? true : undefined} aria-label={sheet ? d.name : undefined} tabIndex={sheet ? -1 : undefined} onKeyDown={event => { if (!sheet) return; trapDialogFocus(event); if (event.key === "Escape") { event.preventDefault(); onBack(); } }}>
    <header className={styles["inbox-head"]}>
    {!wide ? <button ref={back} type="button" className={styles["inbox-back"]} onClick={onBack}><Icon name="chevron-left"/><span>უკან</span></button> : null}
      <CompanyAvatar name={d.name} logoUrl={d.logoUrl}/>
      <div className={styles["inbox-head__text"]}>
        <h2 className={styles["inbox-head__name"]}>{d.isCompany ? <Link href={`/companies/view/?id=${encodeURIComponent(d.otherId)}`}>{d.name}</Link> : d.name}</h2>{!d.requestId ? <p className={styles["inbox-head__context"]}>{d.context}</p> : null}

      </div>
      {phone ? <a className={styles["inbox-call"]} href={`tel:${phone.replace(/[^+\d]/g, "")}`} aria-label={`დარეკვა: ${phone}`} title={phone}><Icon name="phone"/></a> : null}
      <ChatTools conversationId={conversation.id}/>
    </header>
    {d.requestId ? <div className={styles.inboxContext}><ChatContext store={store} requestId={d.requestId} companyId={conversation.companyId} collapsible disclosureGroup={`inbox-${conversation.id}`}/></div> : null}
    <div className={styles["inbox-log"]} ref={log} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}
      onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }}>
      {!loaded ? <p className={styles["inbox-log__note"]} role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p>
        : !messages.length ? <p className={styles["inbox-log__note"]}>შეტყობინება ჯერ არ არის. დაწერეთ პირველი.</p>
        : <ChatMessages messages={messages} owner={me.id} name={d.name} now={now}/>}
    </div>
    {failed && loaded ? <div className={styles["inbox-retry"]} role="alert"><span>განახლება ვერ მოხერხდა.</span><button type="button" className="account-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
    <SharedFiles store={store} target={conversation.id} disclosureGroup={`inbox-${conversation.id}`}/>
    <form className={styles["inbox-compose"]} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="ma-sr-only" htmlFor="inbox-body">შეტყობინება</label>
      <textarea ref={input} id="inbox-body" className="ma-textarea" rows={1} maxLength={2000} value={body} readOnly={pending} aria-invalid={!!(validationError || sendError)} aria-describedby={validationError || sendError ? "inbox-error" : undefined} placeholder="დაწერეთ შეტყობინება…"
        onChange={e => { setBody(e.target.value); setValidationError(""); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}/>
      <Button variant="primary" type="submit" disabled={pending}><Icon name="send"/><span>{pending ? "იგზავნება…" : "გაგზავნა"}</span></Button>
      {validationError || sendError ? <p id="inbox-error" className="ma-field__error" role="alert">{validationError || sendError}</p> : null}
    </form>
  </div>;
  // Below 768 the open thread covers the page under the header, outside any transformed ancestor.
  return sheet ? createPortal(pane, document.body) : <>{pane}<aside className={styles.chatContext}><ChatContext store={store} requestId={d.requestId} companyId={conversation.companyId} expanded/></aside></>;
}
