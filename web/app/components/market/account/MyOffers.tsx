"use client";
import { useState } from "react";
import { Button } from "../../ui/Button";
import { Icon } from "../../Icon";
import type { Store } from "../../../lib/market-client";
import { cities } from "../../../lib/categories";
import { Filters } from "./Filters";
import { RequestPhoto, Status, requestHref, offerLabel, type RequestItem, type OfferItem, type AnyUser } from "./shared";
import { useAccountDeals } from "./MyDeals";
import { dealHref, dealDate, money, useDeal } from "../../../lib/deal-client";
import { Sheet } from "../../ui/Sheet";
import styles from "./account.module.css";

const offerTone = (status: string) => status === "chosen" ? "dark" : status === "sent" ? "warning" : "muted";
function offerPrice(offer: OfferItem, request: RequestItem | null) {
  if (offer.price == null || offer.priceType === "negotiable") return { total: "შეთანხმებით", unit: null };
  const quantity = request?.quantity;
  const total = offer.priceType === "unit" && quantity != null && quantity > 0 ? offer.price * quantity : offer.price;
  const unit = offer.priceType === "unit" ? offer.price : quantity != null && quantity > 0 ? offer.price / quantity : null;
  return { total: `${money(total)}${offer.priceType === "unit" && !(quantity != null && quantity > 0) ? " / ერთეული" : ""}`, unit };
}
function DeliveryDate({ store, actor, dealId }: { store: Store; actor: string; dealId: string }) {
  const { deal } = useDeal(store, dealId, actor);
  return deal?.delivery_date ? <> · {dealDate(deal.delivery_date)}</> : null;
}
const contactNote = "არჩეულამდე მყიდველის კონტაქტი დაფარულია — პასუხი ჩატით ან შეთავაზების განახლებით.";
export function MyOffers({ offers, store, me }: { offers: OfferItem[]; store: Store; me: AnyUser }) {
  const deals = useAccountDeals(store, me.id);
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileId, setMobileId] = useState<string | null>(null);
  const visible = status === "all" ? offers : offers.filter(offer => offer.status === status);
  const selected = visible.find(offer => offer.id === selectedId) || visible.find(offer => offer.status === "chosen") || visible[0];
  const selectedRequest = selected ? store.getRequest(selected.requestId) as RequestItem | null : null;
  const buyer = selectedRequest ? store.userById(selectedRequest.ownerId) as AnyUser | null : null;
  const isChosen = selected?.status === "chosen" && selected.companyUserId === me.id && !me.blocked && selectedRequest && !selectedRequest.hidden && selectedRequest.chosenOfferId === selected.id;
  const contact = isChosen ? store.contactFor(selectedRequest, me) : null;
  const buyerName = buyer?.company || buyer?.name || contact?.company || contact?.name || "მყიდველი";
  const selectedDeal = deals?.items.find(item => item.request_id === selected?.requestId);
  const price = selected ? offerPrice(selected, selectedRequest) : null;
  const detail = selected ? <div className={styles.offerDetailContent}>
    <header><h2 title={selectedRequest?.title}>{selectedRequest?.title || "შეთავაზება"}</h2><Status tone={offerTone(selected.status)}>{offerLabel(selected.status)}</Status></header>
    <dl>
      <div><Icon name="wallet"/><dt>ფასი</dt><dd>{price?.total}{price?.unit != null ? <small>{money(price.unit)} / {store.units[selectedRequest?.unit || ""] || "ერთეული"}</small> : null}</dd></div>
      <div><Icon name="truck"/><dt>მიწოდება</dt><dd>{selected.deliveryDays != null ? `${selected.deliveryDays} დღე` : "დასაზუსტებელია"}{selectedDeal?.deal_id ? <DeliveryDate key={selectedDeal.deal_id} store={store} actor={me.id} dealId={selectedDeal.deal_id}/> : null}</dd></div>
      <div><Icon name="receipt"/><dt>გადახდა</dt><dd>{selected.paymentTerms || "დასაზუსტებელია"}</dd></div>
    </dl>
    <div className={styles.buyer}><span className={styles.buyerAvatar} aria-hidden="true">{buyerName.trim().split(/\s+/).slice(0, 2).map((word: string) => word[0]).join("").toUpperCase()}</span><div><strong>{buyerName}</strong><p>{isChosen && contact?.phone ? <>{contact.name ? `${contact.name} · ` : ""}<a href={`tel:${contact.phone}`}>{contact.phone}</a></> : cities[buyer?.city || selectedRequest?.city || ""] || buyer?.city || selectedRequest?.city}</p></div></div>
    {isChosen ? <p className={styles.contactOpen}><Icon name="lock-keyhole"/>კონტაქტი გაიხსნა არჩევის შემდეგ</p> : null}
    <Button href={selectedDeal?.deal_id ? dealHref(selectedDeal.deal_id) : requestHref(selected.requestId)}><Icon name="message-square"/>დეტალების განხილვა</Button>
  </div> : null;
  return <section className="account-records" aria-label="ჩემი შეთავაზებები">
    <Filters label="შეთავაზების სტატუსი" value={status} onChange={value => { setStatus(value); setSelectedId(null); setMobileId(null); }} items={[{ key: "all", label: "ყველა", count: offers.length }, ...["sent", "chosen", "declined"].map(key => ({ key, label: offerLabel(key), count: offers.filter(offer => offer.status === key).length })).filter(item => item.count > 0)]}/>
    <div className={`account-offers-layout${selected ? " account-offers-layout--detail" : ""}`}>
      {visible.length ? <ul className="account-rows account-offer-list">{visible.map(offer => {
        const request = store.getRequest(offer.requestId) as RequestItem | null;
        const owner = request ? store.userById(request.ownerId) as AnyUser | null : null;
        const activity = `${offer.status === "chosen" ? "აირჩია" : "გაიგზავნა"} · ${dealDate(offer.status === "chosen" ? offer.updatedAt || offer.createdAt : offer.createdAt)}`;
        return <li key={offer.id}><button type="button" className="account-offer-card" aria-pressed={selected?.id === offer.id} onClick={() => { setSelectedId(offer.id); if (window.matchMedia("(max-width:1023px)").matches) setMobileId(offer.id); }}>
          <RequestPhoto request={request}/><span className="account-offer-copy"><strong title={request?.title}>{request?.title || "მოთხოვნა"}</strong><span className="account-offer-buyer">{owner?.company || owner?.name || "მყიდველი"}</span><span className="account-offer-facts"><strong>{offerPrice(offer, request).total}</strong>{offer.deliveryDays != null ? <> · {offer.deliveryDays} დღე</> : null}<span className="account-offer-activity" title={activity}> · {activity}</span></span></span>
          <Status tone={offerTone(offer.status)}>{offerLabel(offer.status)}</Status>
        </button></li>;
      })}</ul> : <div className="account-empty-state"><p className="account-empty">{offers.length ? "ამ სტატუსით შეთავაზება არ არის." : "შეთავაზება ჯერ არ გაგიგზავნია."}</p></div>}
      {selected ? <aside className={styles.offerAside} aria-label="შეთავაზების დეტალები"><section className={styles.offerDetail}>{detail}</section><p className={styles.contactNote}>{contactNote}</p></aside> : null}
    </div>
    <Sheet open={!!selected && mobileId === selected.id} onClose={() => setMobileId(null)} title="შეთავაზების დეტალები">{detail}<p className={styles.contactNote}>{contactNote}</p></Sheet>
  </section>;
}
