"use client";
import { useState } from "react";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import type { Store } from "../../../lib/market-client";
import { cities } from "../../../lib/categories";
import { Filters } from "./Filters";
import { RequestPhoto, Status, requestHref, offerLabel, type RequestItem, type OfferItem, type AnyUser } from "./shared";
import { useAccountDeals } from "./MyDeals";
import { dealHref, dealDate, money } from "../../../lib/deal-client";
import { Sheet } from "../../ui/Sheet";
import { EmptyState } from "../../ui/Structure";
import { FileAttachments } from "../FileAttachments";
import { CompanyAvatar } from "../CompanyAvatar";
import styles from "./account.module.css";

// "viewed" is a sent offer the buyer has opened; it is a filter of its own next to the stored statuses.
const offerKey = (offer: OfferItem) => offer.status === "sent" && offer.viewedAt ? "viewed" : offer.status;
const offerTone = (offer: OfferItem) => offer.status === "chosen" ? "dark" : offer.status === "sent" ? offer.viewedAt ? "info" : "warning" : "muted";
function offerPrice(offer: OfferItem, request: RequestItem | null) {
  if (offer.price == null || offer.priceType === "negotiable") return { total: "შეთანხმებით", unit: null };
  const quantity = request?.quantity;
  const total = offer.priceType === "unit" && quantity != null && quantity > 0 ? offer.price * quantity : offer.price;
  const unit = offer.priceType === "unit" ? offer.price : quantity != null && quantity > 0 ? offer.price / quantity : null;
  return { total: `${money(total)}${offer.priceType === "unit" && !(quantity != null && quantity > 0) ? " / ერთეული" : ""}`, unit };
}
// Shown only until the offer is chosen; after that the contact itself is on the card.
const contactNote = "არჩევამდე მყიდველის კონტაქტი დაფარულია — დაუკავშირდით მიმოწერით ან განაახლეთ შეთავაზება.";
export function MyOffers({ offers, store, me }: { offers: (OfferItem & { body?: string; validUntil?: string | null; commercialTerms?: string[] })[]; store: Store; me: AnyUser }) {
  const deals = useAccountDeals(store, me.id);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileId, setMobileId] = useState<string | null>(null);
  const visible = status === "all" ? offers : offers.filter(offer => offerKey(offer) === status);
  const selected = visible.find(offer => offer.id === selectedId) || visible.find(offer => offer.status === "chosen") || visible[0];
  const selectedRequest = selected ? store.getRequest(selected.requestId) as RequestItem | null : null;
  const buyer = selectedRequest ? store.userById(selectedRequest.ownerId) as AnyUser | null : null;
  const isChosen = selected?.status === "chosen" && selected.companyUserId === me.id && !me.blocked && selectedRequest && !selectedRequest.hidden && selectedRequest.chosenOfferId === selected.id;
  const contact = isChosen ? store.contactFor(selectedRequest, me) : null;
  const buyerName = buyer?.company || buyer?.name || contact?.company || contact?.name || "მყიდველი";
  const selectedDeal = deals?.items.find(item => item.request_id === selected?.requestId);
  const price = selected ? offerPrice(selected, selectedRequest) : null;
  const detail = selected ? <div className={styles.offerDetailContent}>
    <header><h2 title={selectedRequest?.title}>{selectedRequest?.title || "შეთავაზება"}</h2><Status tone={offerTone(selected)}>{offerLabel(selected.status, selected.viewedAt)}</Status></header>
    <dl>
      <div><Icon name="wallet"/><dt>ფასი</dt><dd>{price?.total}{price?.unit != null ? <small>{money(price.unit)} / {store.units[selectedRequest?.unit || ""] || "ერთეული"}</small> : null}</dd></div>
      {selected.deliveryDays != null || selectedDeal?.delivery_date ? <div><Icon name="truck"/><dt>მიწოდება</dt><dd>{[selected.deliveryDays != null ? `${selected.deliveryDays} დღე` : null, selectedDeal?.delivery_date ? dealDate(selectedDeal.delivery_date) : null].filter(Boolean).join(" · ")}</dd></div> : null}
      {selected.paymentTerms ? <div><Icon name="receipt"/><dt>გადახდა</dt><dd>{selected.paymentTerms}</dd></div> : null}
      <div><Icon name="receipt"/><dt>დღგ</dt><dd>{selected.vatIncluded ? "ფასში შედის" : "ფასში არ შედის"}</dd></div>
      <div><Icon name="truck"/><dt>მიწოდების ხარჯი</dt><dd>{selected.deliveryIncluded ? "ფასში შედის" : "დასაზუსტებელია"}</dd></div>
      <div><Icon name="calendar"/><dt>შეთავაზება ძალაშია</dt><dd>{selected.validUntil ? dealDate(selected.validUntil) : "არ არის მითითებული"}</dd></div>
      <div><Icon name="check"/><dt>კომერციული პირობები</dt><dd>{selected.commercialTerms?.join(" · ") || "არ არის მითითებული"}</dd></div>
    </dl>
    {selected.body ? <p>{selected.body}</p> : null}
    <FileAttachments store={store} kind="offer" target={selected.id} label="შეთავაზების ფაილები"/>
    <div className={styles.buyer}><CompanyAvatar name={buyerName} logoUrl={buyer?.logoUrl}/><div><strong>{buyerName}</strong><p>{isChosen && contact?.phone ? <>{contact.name ? `${contact.name} · ` : ""}<a href={`tel:${contact.phone}`}>{contact.phone}</a></> : cities[buyer?.city || selectedRequest?.city || ""] || buyer?.city || selectedRequest?.city}</p></div></div>
    {isChosen ? <p className={styles.contactOpen}><Icon name="lock-keyhole"/>კონტაქტი გაიხსნა არჩევის შემდეგ</p> : null}
    <Button href={selectedDeal ? dealHref(selectedDeal.id) : requestHref(selected.requestId)}><Icon name="message-square"/>დეტალების განხილვა</Button>
  </div> : null;
  return <section className="account-records" aria-label="ჩემი შეთავაზებები">
    <Filters label="შეთავაზების სტატუსი" value={status} onChange={value => { setStatus(value); setSelectedId(null); setMobileId(null); }} items={[{ key: "all", label: "ყველა", count: offers.length }, ...["sent", "viewed", "chosen", "declined"].map(key => ({ key, label: key === "viewed" ? "ნანახია" : offerLabel(key), count: offers.filter(offer => offerKey(offer) === key).length })).filter(item => item.count > 0)]}/>
    <div className={`account-offers-layout${selected ? " account-offers-layout--detail" : ""}`}>
      {visible.length ? <ul className="account-rows account-offer-list">{visible.map(offer => {
        const request = store.getRequest(offer.requestId) as RequestItem | null;
        const owner = request ? store.userById(request.ownerId) as AnyUser | null : null;
        const activity = offer.status === "chosen" ? `არჩეულია · ${dealDate(offer.updatedAt || offer.createdAt)}` : offer.status === "sent" && offer.viewedAt ? `ნანახია · ${dealDate(offer.viewedAt)}` : `გაიგზავნა · ${dealDate(offer.createdAt)}`;
        return <li key={offer.id}><button type="button" className="account-offer-card" aria-pressed={selected?.id === offer.id} onClick={() => { setSelectedId(offer.id); if (window.matchMedia("(max-width:1023px)").matches) setMobileId(offer.id); }}>
          <RequestPhoto request={request}/><span className="account-offer-copy"><strong title={request?.title}>{request?.title || "მოთხოვნა"}</strong><span className="account-offer-buyer">{owner?.company || owner?.name || "მყიდველი"}</span><span className="account-offer-facts"><strong>{offerPrice(offer, request).total}</strong>{offer.deliveryDays != null ? <> · {offer.deliveryDays} დღე</> : null}<span className="account-offer-activity" title={activity}> · {activity}</span></span></span>
          <Status tone={offerTone(offer)}>{offerLabel(offer.status, offer.viewedAt)}</Status>
        </button>{offer.status === "sent" && request && store.requestState(request) === "open" ? <Button variant="secondary" href={`/offers/new/?requestId=${encodeURIComponent(offer.requestId)}`}><Icon name="pencil"/>რედაქტირება</Button> : null}</li>;
      })}</ul> : offers.length ? <EmptyState icon="send" text="ამ სტატუსით შეთავაზება არ არის." action={<Button variant="secondary" onClick={() => setStatus("all")}>ყველა შეთავაზების ნახვა</Button>}/> : <EmptyState icon="send" title="შეთავაზებები ჯერ არ გაგიგზავნიათ" text="შეარჩიეთ თქვენთვის შესაფერისი მოთხოვნა და გაუგზავნეთ შეთავაზება." action={<Button href="/matching/"><Icon name="inbox"/>შესაძლებლობების ნახვა</Button>}/>}
      {selected ? <aside className={styles.offerAside} aria-label="შეთავაზების დეტალები"><section className={styles.offerDetail}>{detail}</section>{isChosen ? null : <p className={styles.contactNote}>{contactNote}</p>}</aside> : null}
    </div>
    <Sheet open={!!selected && mobileId === selected.id} onClose={() => setMobileId(null)} title="შეთავაზების დეტალები">{detail}{isChosen ? null : <p className={styles.contactNote}>{contactNote}</p>}</Sheet>
  </section>;
}
