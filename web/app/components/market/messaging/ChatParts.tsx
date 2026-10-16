"use client";
import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../../ui/Button";
import { cities, units } from "../../../lib/categories";
import type { Store } from "../../../lib/market-client";
import type { Message } from "../../../lib/chat-client";
import { dateShort, money } from "../../../lib/format";
import styles from "./ChatParts.module.css";
import { Icon } from "../../Icon";
import { ReportButton } from "../ReportButton";

const day = (value: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
export function ChatMessages({ messages, owner, name, now }: { messages: Message[]; owner: string; name: string; now: number }) {
 return messages.map((message, index) => {
  const date = day(message.createdAt), days = Math.round((Date.parse(day(now)) - Date.parse(date)) / 86400000);
  const mine = message.senderId === owner;
  return <Fragment key={message.id}>
   {!index || day(messages[index - 1].createdAt) !== date ? <p className={styles.day}>{days <= 0 ? "დღეს" : days === 1 ? "გუშინ" : dateShort(date)}</p> : null}
   <div className={styles.message} data-mine={mine || undefined}><span className="ma-sr-only">{mine ? "თქვენ" : name}: </span><p>{message.body}</p><time dateTime={message.createdAt}>{clock(message.createdAt)}</time></div>
  </Fragment>;
 });
}
/** Compact conversation actions shared by the dock and the full inbox. */
export function ChatTools({ conversationId }: { conversationId: string }) {
 return <details className={styles.tools} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }} onKeyDown={event => { if (event.key === "Escape" && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary aria-label="საუბრის მოქმედებები" title="საუბრის მოქმედებები"><Icon name="ellipsis"/></summary><div><ReportButton kind="conversation" targetId={conversationId}/></div></details>;
}
export function ChatContext({ store, requestId, companyId, expanded = false, collapsible = false, disclosureGroup }: { store: Store; requestId?: string | null; companyId: string; expanded?: boolean; collapsible?: boolean; disclosureGroup?: string }) {
 const request = requestId ? store.getRequest(requestId) : null;
 const offer = request ? store.visibleOffers(request.id).find((item: { companyUserId: string }) => item.companyUserId === companyId) : null;
 const status = request ? store.requestState(request) : null;
 // Only link a deal when an actual notification identifies it and this is the chosen supplier.
 const notice = offer && request?.chosenOfferId === offer.id ? store.engagement()?.notifications?.items?.find((item: { request_id: string; deal_id?: string }) => item.request_id === requestId && item.deal_id) : null;
 if (!requestId) return <div className={styles.context}>პირადი მიმოწერა</div>;
 if (expanded) return <div className={styles.expanded}>
  <section><h2>მოთხოვნა</h2><div className={styles.requestCard}>{request?.photo ? <Image unoptimized src={request.photo} alt="" width={56} height={44}/> : null}<div><h3>{request?.title || "მოთხოვნის შესახებ"}</h3><p>{[request?.quantity != null ? `${request.quantity} ${units[request.unit] || ""}` : null, cities[request?.city] || request?.city].filter(Boolean).join(" · ")}</p></div></div>{status ? <span className="ma-badge ma-badge--neutral">{store.stateLabels[status] || status}</span> : null}</section>
  {offer ? <section><h2>{request?.ownerId === store.currentUser()?.id ? "მათი შეთავაზება" : "თქვენი შეთავაზება"}</h2><dl><div><dt>ფასი</dt><dd>{money(offer.price == null ? null : Number(offer.price))}</dd></div>{offer.deliveryDays != null ? <div><dt>შესრულების ვადა</dt><dd>{offer.deliveryDays} დღე</dd></div> : null}{dateShort(offer.validUntil) ? <div><dt>ძალაშია</dt><dd>{dateShort(offer.validUntil)}-მდე</dd></div> : null}</dl><Button variant={request?.ownerId === store.currentUser()?.id ? "primary" : "secondary"} href={request?.ownerId === store.currentUser()?.id ? `/requests/compare/?id=${encodeURIComponent(requestId)}` : `/requests/view/?id=${encodeURIComponent(requestId)}`}>{request?.ownerId === store.currentUser()?.id ? "შეთავაზებების შედარება" : "შეთავაზების ნახვა"}</Button></section> : null}
 </div>;
 const content = <section className={styles.context} aria-label="საუბრის კონტექსტი">
  {!collapsible && <strong>{request?.title || "მოთხოვნის შესახებ"}</strong>}
  <div className={styles.facts}>{offer ? <><span>{offer.price == null ? "ფასი შეთანხმებით" : `${money(Number(offer.price))}${offer.priceType === "unit" ? " / ერთეული" : ""}`}</span>{offer.deliveryDays != null ? <span>ვადა: {offer.deliveryDays} დღე</span> : null}</> : null}{status ? <span className="ma-badge ma-badge--neutral">{store.stateLabels[status] || status}</span> : null}</div>
  <nav aria-label="საუბრის ბმულები"><Link href={`/requests/view/?id=${encodeURIComponent(requestId)}`}>მოთხოვნა</Link>{offer ? <Link href={`/requests/view/?id=${encodeURIComponent(requestId)}${request?.ownerId === store.currentUser()?.id ? "#request-responses" : ""}`}>შეთავაზება</Link> : null}{notice ? <Link href={`/deals/view/?id=${encodeURIComponent(notice.deal_id)}`}>გარიგება</Link> : null}</nav>
 </section>;
 return collapsible ? <details name={disclosureGroup} className={styles.disclosure}><summary><Icon name="file-text"/><span>{request?.title || "მოთხოვნის შესახებ"}</span><Icon name="chevron-down"/></summary>{content}</details> : content;
}
