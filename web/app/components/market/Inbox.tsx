"use client";
import { Button } from "../ui/Button";


import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./engagement.module.css";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import type { Store } from "../../lib/market-client";
import { useChatThread, useConversationList, type Conversation, type Message } from "../../lib/chat-client";
import { categories, cities } from "../../lib/categories";
import { usePublicPhone } from "../../lib/phones";
import { Icon } from "../Icon";
import { trapDialogFocus } from "../ui/dialog-focus";

type Me = { id: string; role: string };
type Profile = { logoUrl?: string | null; role?: string; industry?: string } | null;
const WIDE = "(min-width:1024px)";
const DAY = 86400000;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase();
function Avatar({ name }: { name: string }) { return <span className={styles.chatAvatar} aria-hidden="true">{initials(name)}</span>; }

// Calendar days and clock times in Tbilisi, whatever the viewer's zone.
const dayKey = (value: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const daysAgo = (value: string, now: number) => Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(value))) / DAY);
const dotted = (value: string) => dayKey(value).split("-").reverse().join(".");
function rowTime(value: string, now: number) {
  const days = daysAgo(value, now);
  return days <= 0 ? clock(value) : days === 1 ? "გუშინ" : days < 7 ? `${days} დღის წინ` : dotted(value);
}
function dayLabel(value: string, now: number) {
  const days = daysAgo(value, now);
  return days <= 0 ? "დღეს" : days === 1 ? "გუშინ" : dotted(value);
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
  const isCompany = profile?.role === "company" || (!!c.otherCompany && otherId === c.companyId);
  const context = requestId ? request?.title || "მოთხოვნის შესახებ" : isCompany && profile?.industry ? categories[profile.industry] || profile.industry : "პირადი მიმოწერა";
  return { otherId, name, logoUrl: profile?.logoUrl, context, isCompany, requestId, requestFound: !!request };
}

export function Inbox({ store, me }: { store: Store; me: Me }) {
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

  if (!current) return <section className={styles["inbox"] + " " + styles["inbox--empty"]} aria-busy="true"><header className={styles["inbox-section-head"]}><h1>მესიჯები</h1><p>კლიენტებთან და კომპანიებთან საუბრები ერთ სივრცეში.</p></header><div className="account-empty-state" role="status"><span className="icon-tile" aria-hidden="true"><Icon name="message-square"/></span><p className="account-empty">მიმოწერები იტვირთება…</p></div></section>;
  if (current.error && !items) return <section className={`${styles["inbox"]} ${styles["inbox--empty"]}`}><header className={styles.panelHead}><h1>მესიჯები</h1></header><div role="alert" className={styles["inbox-note"]}><p className="account-empty">{current.error}</p><button type="button" className="account-link" onClick={retry}>ხელახლა ცდა</button></div></section>;
  if (!items?.length) return <section className={styles["inbox"] + " " + styles["inbox--empty"]} aria-labelledby="inbox-heading">
    <header className={styles["inbox-section-head"]}><h1 id="inbox-heading">მესიჯები</h1><p>კლიენტებთან და კომპანიებთან საუბრები ერთ სივრცეში.</p></header>
    <div className={"account-empty-state" + " " + styles["inbox-empty-state"]}>
      <span className="icon-tile" aria-hidden="true"><Icon name="message-square"/></span>
      <h2 className="account-empty-state__title">პირველი საუბარი წინ არის</h2>
      <p className="account-empty">{me.role === "company" ? "აქ გამოჩნდება კლიენტებთან მიმოწერები. შეარჩიე მოთხოვნა და შესთავაზე შენი მომსახურება — საუბარი მოთხოვნასთან ერთად შეინახება." : "მოძებნე შესაბამისი კომპანია და მის პროფილზე აირჩიე მიმოწერის დაწყება. ყველა საუბარს აქ დაუბრუნდები."}</p>
      <Button variant="primary" href={me.role === "company" ? "/account/?tab=opportunities" : "/companies/"}>{me.role === "company" ? "შესაბამისი მოთხოვნების ნახვა" : "კომპანიების ნახვა"}</Button>
      <p className={styles["inbox-empty-state__tip"]}>შეთანხმებები და მნიშვნელოვანი დეტალები შეინახე ერთ მიმოწერაში.</p>
    </div>
  </section>;

  return <section className={styles.inboxRoot}><header className={styles.panelHead}><h1>მესიჯები</h1></header><div className={styles["inbox"]} data-view={active && !wide ? "thread" : "list"} aria-label="მიმოწერები">
    <div className={styles["inbox-list"]} data-conversations>
      <label className={styles.chatSearch}><Icon name="search"/><span className="ma-sr-only">საუბრის ძიება</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ძიება"/></label>
      <ul>
        {visibleItems?.map(c => {
          const d = describe(store, me, c);
          const last = c.lastMessage;
          const unread = c.unreadCount > 0;
          return <li key={c.id} data-id={c.id} data-context={d.requestId ? "request" : "general"}>
            <button type="button" className={styles["inbox-row"]} aria-current={c.id === active?.id ? "true" : undefined} data-unread={unread || undefined} onClick={event => { opener.current = event.currentTarget; setSelection({ query, id: c.id }); }}>
              <Avatar name={d.name}/>
              <span className={styles["inbox-row__text"]}>
                <span className={styles["inbox-row__top"]}>
                  <span className={styles["inbox-row__name"]}>{d.name}{unread ? <span className="ma-sr-only">, წაუკითხავი</span> : null}</span>
                  <span className={styles.rowMeta}>{unread ? <span className={styles.unreadCount}>{c.unreadCount}</span> : <time dateTime={c.lastMessageAt || c.createdAt}>{rowTime(c.lastMessageAt || c.createdAt, now)}</time>}</span>
                </span>
                <span className={styles["inbox-row__preview"]}>{last ? `${last.senderId === me.id ? "შენ: " : ""}${last.body}` : "შეტყობინება ჯერ არ არის"}</span>
                <span className={styles["inbox-row__context"]}>{d.context}</span>
              </span>
            </button>
          </li>;
        })}
      </ul>
      {!visibleItems?.length ? <p className={styles["inbox-note"]} role="status">საუბარი ვერ მოიძებნა.</p> : null}
    </div>
    {active ? <Thread key={active.id} store={store} me={me} conversation={active} wide={!!wide} onBack={backToList}/> : wide === false ? null : <div className={styles["inbox-thread"] + " " + styles["inbox-thread--none"]}/>}
    {active && wide ? <ConversationContext store={store} me={me} conversation={active}/> : null}
  </div></section>;
}

function Thread({ store, me, conversation, wide, onBack }: { store: Store; me: Me; conversation: Conversation; wide: boolean; onBack: () => void }) {
  // The target is fixed per opened conversation so list refreshes do not restart polling.
  const [target] = useState(() => ({ companyId: conversation.companyId, conversation }));
  const { messages, loaded, failed, pending, sendError, send, retry } = useChatThread(store, target);
  const d = describe(store, me, conversation);
  // Public company phone only (same projection as the profile page); clients have none.
  const phone = usePublicPhone(store, d.isCompany ? d.otherId : undefined);
  const [body, setBody] = useState("");
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
    if (await send(body, () => { atBottom.current = true; })) { setBody(""); input.current?.focus(); }
  }
  let lastDay = "";
  const sheet = !wide;
  const requestHref = d.requestId && d.requestFound ? `/requests/view/?id=${encodeURIComponent(d.requestId)}` : "";
  const pane = <div ref={paneRef} className={`${styles["inbox-thread"]} ${sheet ? styles["inbox-thread--sheet"] : ""}`} role={sheet ? "dialog" : undefined} aria-modal={sheet ? true : undefined} aria-label={sheet ? d.name : undefined} tabIndex={sheet ? -1 : undefined} onKeyDown={event => { if (!sheet) return; trapDialogFocus(event); if (event.key === "Escape") { event.preventDefault(); onBack(); } }}>
    <header className={styles["inbox-head"]}>
    {!wide ? <button ref={back} type="button" className={styles["inbox-back"]} onClick={onBack}><Icon name="chevron-left"/><span className="ma-sr-only">საუბრების სიაში დაბრუნება</span></button> : null}
      <Avatar name={d.name}/>
      <div className={styles["inbox-head__text"]}>
        <h3 className={styles["inbox-head__name"]}>{d.isCompany ? <Link href={`/companies/view/?id=${encodeURIComponent(d.otherId)}`}>{d.name}</Link> : d.name}</h3>
        <p className={`${styles["inbox-head__context"]} ${wide && requestHref ? styles.contextInAside : ""}`}>{requestHref ? <Link href={requestHref}>{d.context}</Link> : d.context}</p>
      </div>
      {phone ? <a className={styles["inbox-call"]} href={`tel:${phone.replace(/[^+\d]/g, "")}`} aria-label={`დარეკვა: ${phone}`} title={phone}><Icon name="phone"/></a> : null}
    </header>
    <div className={styles["inbox-log"]} ref={log} role="log" aria-label="საუბრის შეტყობინებები" aria-live="polite" aria-relevant="additions" aria-busy={!loaded && !failed}
      onScroll={e => { const n = e.currentTarget; atBottom.current = n.scrollHeight - n.scrollTop - n.clientHeight < 80; }}>
      {!loaded ? <p className={styles["inbox-log__note"]} role="status">{failed ? "საუბარი ვერ ჩაიტვირთა." : "საუბარი იტვირთება…"}</p>
        : !messages.length ? <p className={styles["inbox-log__note"]}>შეტყობინება ჯერ არ არის. დაწერე პირველი.</p>
        : messages.map((m: Message) => {
          const day = dayKey(m.createdAt);
          const divider = day !== lastDay ? <p className={styles["inbox-day"]} key={`d-${day}`}>{dayLabel(m.createdAt, now)}</p> : null;
          lastDay = day;
          const mine = m.senderId === me.id;
          return [divider, <div key={m.id} className={styles["inbox-msg"]} data-mine={mine || undefined}>
            <span className="ma-sr-only">{mine ? "შენ" : d.name}: </span>
            <p>{m.body}</p>
            <time dateTime={m.createdAt}>{clock(m.createdAt)}</time>
          </div>];
        })}
    </div>
    {failed && loaded ? <div className={styles["inbox-retry"]} role="alert"><span>განახლება ვერ მოხერხდა.</span><button type="button" className="account-link" onClick={retry}>ხელახლა ცდა</button></div> : null}
    <form className={styles["inbox-compose"]} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="ma-sr-only" htmlFor="inbox-body">შეტყობინება</label>
      <textarea ref={input} id="inbox-body" className="ma-textarea" rows={1} maxLength={2000} value={body} readOnly={pending} placeholder="დაწერე შეტყობინება…"
        onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); } }}/>
      <Button variant="primary" type="submit" disabled={!loaded || !body.trim() || pending}><Icon name="send"/><span className="ma-sr-only">{pending ? "იგზავნება…" : "გაგზავნა"}</span></Button>
      {sendError ? <p className="ma-field__error" role="alert">{sendError}</p> : null}
    </form>
  </div>;
  // Below 1024 the open thread covers the page under the header, outside any transformed ancestor.
  return sheet ? createPortal(pane, document.body) : pane;
}

function ConversationContext({ store, me, conversation }: { store: Store; me: Me; conversation: Conversation }) {
 const d = describe(store, me, conversation);
 const request = d.requestId ? store.getRequest(d.requestId) : null;
 const offers = request ? store.visibleOffers(request.id) : [];
 const offer = offers.find((o: { companyUserId: string }) => o.companyUserId === conversation.companyId);
 const status = request ? store.requestState(request) : null;
 return <aside className={styles.chatContext} aria-label="საუბრის კონტექსტი">
  <section><h2>{d.requestId ? "მოთხოვნა" : "პირადი მიმოწერა"}</h2>
   {request ? <><div className={styles.contextRequest}>{request.photo ? <Image src={request.photo} alt="" width={56} height={44} unoptimized/> : null}<div><h3>{request.title}</h3><p>{[request.quantity != null ? `${request.quantity} ${store.units[request.unit] || ""}` : null, cities[request.city] || request.city].filter(Boolean).join(" · ")}</p></div></div><span className={styles.statusPill} data-tone={status === "open" ? "info" : status === "chosen" ? "success" : "neutral"}>{store.stateLabels[status] || status}</span></> : <p>{d.requestId ? "მოთხოვნის დეტალები ამჟამად მიუწვდომელია." : "ამ საუბარს მოთხოვნა არ უკავშირდება."}</p>}
  </section>
  {offer ? <section><h2>{me.id === conversation.companyId ? "შენი შეთავაზება" : "მათი შეთავაზება"}</h2><dl>
   <div><dt>ფასი</dt><dd>{offer.price == null ? "შეთანხმებით" : `${Number(offer.price).toLocaleString("ka-GE")} ₾${offer.priceType === "unit" ? " / ერთეული" : ""}`}</dd></div>
   {offer.price != null ? <div><dt>დღგ</dt><dd>{offer.vatIncluded ? "შედის" : "არ შედის"}</dd></div> : null}
   {offer.deliveryDays != null ? <div><dt>მიწოდება</dt><dd>{offer.deliveryDays} დღე</dd></div> : null}
   <div><dt>ტრანსპორტირება</dt><dd>{offer.deliveryIncluded ? "ფასში შედის" : "ცალკე"}</dd></div>
  </dl></section> : null}
  {d.requestId ? <section><Button href={`/requests/view/?id=${encodeURIComponent(d.requestId)}`} variant="primary">მოთხოვნის ნახვა</Button></section> : null}
 </aside>;
}
