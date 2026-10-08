"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import { openChat } from "../ChatPopup";
import type { Store } from "../../../lib/market-client";
import { cities } from "../../../lib/categories";
import { Filters } from "./Filters";
import { RequestPhoto, Status, requestHref, offerLabel, amount, type RequestItem, type OfferItem, type AnyUser } from "./shared";
import { useAccountDeals } from "./MyDeals";
import { dealHref, dealDate } from "../../../lib/deal-client";
import { Sheet } from "../../ui/Sheet";
import styles from "../Matching.module.css";
export function MyOffers({ offers, store, me }: { offers: OfferItem[]; store: Store; me: AnyUser }) {
  const deals = useAccountDeals(store, me.id);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileId, setMobileId] = useState<string | null>(null);
  const visible = status === "all" ? offers : offers.filter(offer => offer.status === status);
  const selected = visible.find(offer => offer.id === selectedId) || visible.find(offer => offer.status === "chosen") || visible[0];
  const selectedRequest = selected ? store.getRequest(selected.requestId) as RequestItem | null : null;
  const buyer = selectedRequest ? store.userById(selectedRequest.ownerId) as AnyUser | null : null;
  const canChat = selected?.status === "chosen" && selected.companyUserId === me.id && !me.blocked && selectedRequest && !selectedRequest.hidden && selectedRequest.chosenOfferId === selected.id;
  const selectedDeal = deals?.items.find(item => item.request_id === selected?.requestId);
  const detail = selected ? <><h2>{selectedRequest?.title || "შეთავაზება"}</h2><Status tone={selected.status === "chosen" ? "dark" : selected.status === "sent" ? "warning" : "neutral"}>{offerLabel(selected.status)}</Status><dl><div><dt>ფასი</dt><dd>{amount(selected)}</dd></div>{selected.deliveryDays != null ? <div><dt>მიწოდება</dt><dd>{selected.deliveryDays} დღე</dd></div> : null}<div><dt>პირობები</dt><dd>ტრანსპორტირება {selected.deliveryIncluded ? "შედის" : "დასაზუსტებელია"}{selected.price != null ? ` · დღგ ${selected.vatIncluded ? "შედის" : "არ შედის"}` : ""}</dd></div>{selected.paymentTerms ? <div><dt>გადახდა</dt><dd>{selected.paymentTerms}</dd></div> : null}</dl>{buyer ? <div className="account-buyer-card"><strong>{buyer.company || buyer.name}</strong><p>{cities[buyer.city] || buyer.city}</p></div> : null}<p>{selected.status === "chosen" ? "არჩეულია" : "გაიგზავნა"} {dealDate(selected.status === "chosen" ? selected.updatedAt || selected.createdAt : selected.createdAt)}</p>{selected.status === "chosen" && selectedDeal?.deal_id ? <Button variant="secondary" href={dealHref(selectedDeal.deal_id)}>გარიგება</Button> : null}<Link className="account-link" href={requestHref(selected.requestId)}>მოთხოვნის ნახვა</Link>{selected.status === "sent" && selectedRequest && store.requestState(selectedRequest) === "open" ? <Link className="account-link" href={`/offers/new/?requestId=${selected.requestId}`}>შეთავაზების რედაქტირება</Link> : null}{canChat ? <Button variant="primary" onClick={() => { setMobileId(null); openChat({ companyId: me.id, requestId: selected.requestId }); }}><Icon name="message-square"/>დეტალების განხილვა</Button> : null}</> : null;
  return <section className="account-records" aria-label="ჩემი შეთავაზებები">
    <Filters label="შეთავაზების სტატუსი" value={status} onChange={value => { setStatus(value); setSelectedId(null); setMobileId(null); }} items={[{ key: "all", label: "ყველა", count: offers.length }, ...["sent", "chosen", "declined"].map(key => ({ key, label: offerLabel(key), count: offers.filter(offer => offer.status === key).length }))]}/>
    <div className={`account-offers-layout${selected ? " account-offers-layout--detail" : ""}`}>
      {visible.length ? <ul className="account-rows account-offer-list">{visible.map(offer => {
        const request = store.getRequest(offer.requestId) as RequestItem | null;
        const owner = request ? store.userById(request.ownerId) as AnyUser | null : null;
        return <li key={offer.id}><button type="button" className={`account-offer-card ${styles.offerRow}`} aria-pressed={selected?.id === offer.id} onClick={() => { setSelectedId(offer.id); if (window.matchMedia("(max-width:1023px)").matches) setMobileId(offer.id); }}><RequestPhoto request={request}/><span className="account-offer-copy"><strong className={styles.offerTitle}>{request?.title || "მოთხოვნა"}</strong><span className={`account-offer-buyer ${styles.offerBuyer}`}><span>{owner?.company || owner?.name || "მყიდველი"}{request?.city ? ` · ${cities[request.city] || request.city}` : ""}</span><Status tone={offer.status === "chosen" ? "dark" : offer.status === "sent" ? "warning" : "neutral"}>{offerLabel(offer.status)}</Status></span><span className="account-offer-facts"><strong>{amount(offer)}</strong>{offer.deliveryDays != null ? <span><Icon name="truck"/>{offer.deliveryDays} დღე</span> : null}</span><span className="account-offer-activity">{offer.status === "chosen" ? "არჩეულია" : "გაიგზავნა"} {dealDate(offer.status === "chosen" ? offer.updatedAt || offer.createdAt : offer.createdAt)}</span></span></button></li>;
      })}</ul> : <div className="account-empty-state"><p className="account-empty">{offers.length ? "ამ სტატუსით შეთავაზება არ არის." : "შეთავაზება ჯერ არ გაგიგზავნია."}</p></div>}
      {selected ? <aside className="account-offer-detail" aria-label="შეთავაზების დეტალები">{detail}</aside> : null}
    </div>
    <Sheet open={!!selected && mobileId === selected.id} onClose={() => setMobileId(null)} title="შეთავაზების დეტალები"><div className={styles.offerSheet}>{detail}</div></Sheet>
  </section>;
}
