"use client";
import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../../ui/Button";
import { cities, units } from "../../../lib/categories";
import type { Store } from "../../../lib/market-client";
import type { Message } from "../../../lib/chat-client";
import { Icon } from "../../Icon";
import styles from "./ChatParts.module.css";

const day = (value: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
export function ChatMessages({ messages, owner, name, now }: { messages: Message[]; owner: string; name: string; now: number }) {
 return messages.map((message, index) => {
  const date = day(message.createdAt), days = Math.round((Date.parse(day(now)) - Date.parse(date)) / 86400000);
  const mine = message.senderId === owner;
  return <Fragment key={message.id}>
   {!index || day(messages[index - 1].createdAt) !== date ? <p className={styles.day}>{days <= 0 ? "დღეს" : days === 1 ? "გუშინ" : date.split("-").reverse().join(".")}</p> : null}
   <div className={styles.message} data-mine={mine || undefined}><span className="ma-sr-only">{mine ? "შენ" : name}: </span><p>{message.body}</p><time dateTime={message.createdAt}>{clock(message.createdAt)}</time></div>
  </Fragment>;
 });
}
export function MessagingEmpty({ title, children }: { title: string; children: React.ReactNode }) {
 return <div className={styles.empty}><span><Icon name="message-square"/></span><h2>{title}</h2><p>{children}</p></div>;
}
export function ChatContext({ store, requestId, companyId, expanded = false }: { store: Store; requestId?: string | null; companyId: string; expanded?: boolean }) {
 const request = requestId ? store.getRequest(requestId) : null;
 const offer = request ? store.visibleOffers(request.id).find((item: { companyUserId: string }) => item.companyUserId === companyId) : null;
 const status = request ? store.requestState(request) : null;
 // Only link a deal when an actual notification identifies it and this is the chosen supplier.
 const notice = offer && request?.chosenOfferId === offer.id ? store.engagement()?.notifications?.items?.find((item: { request_id: string; deal_id?: string }) => item.request_id === requestId && item.deal_id) : null;
 if (!requestId) return <div className={styles.context}>პირადი მიმოწერა</div>;
 if (expanded) return <div className={styles.expanded}>
  <section><h2>მოთხოვნა</h2><div className={styles.requestCard}>{request?.photo ? <Image unoptimized src={request.photo} alt="" width={56} height={44}/> : null}<div><h3>{request?.title || "მოთხოვნის შესახებ"}</h3><p>{[request?.quantity != null ? `${request.quantity} ${units[request.unit] || ""}` : null, cities[request?.city] || request?.city].filter(Boolean).join(" · ")}</p></div></div>{status ? <span className={styles.status}>{store.stateLabels[status] || status}</span> : null}</section>
  {offer ? <section><h2>{request?.ownerId === store.currentUser()?.id ? "მათი შეთავაზება" : "თქვენი შეთავაზება"}</h2><dl><div><dt>ფასი</dt><dd>{offer.price == null ? "შეთანხმებით" : `₾${Number(offer.price).toLocaleString("ka-GE")}`}</dd></div>{offer.deliveryDays != null ? <div><dt>მიწოდება</dt><dd>{offer.deliveryDays} დღე</dd></div> : null}{offer.validUntil ? <div><dt>ძალაშია</dt><dd>{new Date(offer.validUntil).toLocaleDateString("ka-GE")}</dd></div> : null}</dl><Button variant={request?.ownerId === store.currentUser()?.id ? "primary" : "secondary"} href={request?.ownerId === store.currentUser()?.id ? `/requests/compare/?id=${encodeURIComponent(requestId)}` : `/requests/view/?id=${encodeURIComponent(requestId)}`}>{request?.ownerId === store.currentUser()?.id ? "შეთავაზებების შედარება" : "შეთავაზების ნახვა"}</Button></section> : null}
 </div>;
 return <section className={styles.context} aria-label="საუბრის კონტექსტი">
  <strong>{request?.title || "მოთხოვნის შესახებ"}</strong>
  <div className={styles.facts}>{offer ? <><span>{offer.price == null ? "ფასი შეთანხმებით" : `${Number(offer.price).toLocaleString("ka-GE")} ₾${offer.priceType === "unit" ? " / ერთეული" : ""}`}</span>{offer.deliveryDays != null ? <span>მიწოდება: {offer.deliveryDays} დღე</span> : null}</> : null}{status ? <span className={styles.status}>{store.stateLabels[status] || status}</span> : null}</div>
  <nav aria-label="საუბრის ბმულები"><Link href={`/requests/view/?id=${encodeURIComponent(requestId)}`}>მოთხოვნა</Link>{offer ? <Link href={`/requests/view/?id=${encodeURIComponent(requestId)}${request?.ownerId === store.currentUser()?.id ? "#request-responses" : ""}`}>შეთავაზება</Link> : null}{notice ? <Link href={`/deals/view/?id=${encodeURIComponent(notice.deal_id)}`}>გარიგება</Link> : null}</nav>
 </section>;
}
