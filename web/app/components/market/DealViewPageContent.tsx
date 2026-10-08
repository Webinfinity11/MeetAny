"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { useDeal, dealActionLabel, dealDate, money } from "../../lib/deal-client";
import type { Conversation } from "../../lib/chat-client";
import { units } from "../../lib/categories";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { NewTermsModal } from "./modals/NewTermsModal";
import { ReportIssueModal } from "./modals/ReportIssueModal";
import { ReviewModal } from "./modals/ReviewModal";
import { DealContactCard, DealShell, DealTermsRecord } from "./DealShell";
import { DealDiscussion } from "./DealDiscussion";
import { DetailSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import styles from "./deals.module.css";

export function DealViewPageContent() {
  const { store, sessionReady, available } = useMarketStore();
  const id = useSearchParams().get("id") || "";
  const me = store?.currentUser();
  if (!id) return <div className={styles.page}><h1>გარიგება არ არის მითითებული</h1><Button href="/account/?tab=notifications">შეტყობინებები</Button></div>;
  if (!sessionReady) return <DetailSkeleton label="გარიგება იტვირთება…"/>;
  if (!available) return <div className={styles.page}><ServiceUnavailable/></div>;
  if (!me || me.blocked) return <div className={styles.page}><h1>გარიგებაზე წვდომა შეზღუდულია</h1><p>გარიგებას მხოლოდ მისი მონაწილეები ხედავენ.</p>{!me ? <Button href={`/account/?next=${encodeURIComponent(`/deals/view/?id=${id}`)}`}>ანგარიშში შესვლა</Button> : null}</div>;
  return <DealWorkspace key={`${me.id}:${id}`} store={store!} id={id} actor={me.id}/>;
}

function DealWorkspace({ store, id, actor }: { store: Store; id: string; actor: string }) {
  const flow = useDeal(store, id, actor);
  const deal = flow.deal;
  const detail = useRequestDetail(store, !!deal, true, deal?.request_id || "");
  const [reporting, setReporting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"complete" | "cancelled" | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const requestId = deal?.request_id, supplierId = deal?.supplier_id;
  useEffect(() => {
    if (!requestId || !supplierId) return;
    let active = true;
    void store.listConversations().then((items: Conversation[]) => { if (active) setConversationId(items.find(c => c.requestId === requestId && c.companyId === supplierId)?.id); }).catch(() => {});
    return () => { active = false; };
  }, [store, requestId, supplierId]);
  if (flow.error) return <div className={styles.page}><h1>{flow.denied ? "გარიგებაზე წვდომა შეზღუდულია" : "გარიგება ვერ ჩაიტვირთა"}</h1><p role="alert">{flow.error}</p><div className={styles.actions}><Button variant="secondary" loading={flow.pending} onClick={() => void flow.refresh()}>ხელახლა ცდა</Button><Button href="/account/?tab=notifications" variant="secondary">შეტყობინებები</Button></div></div>;
  if (!deal) return <DetailSkeleton label="გარიგება იტვირთება…"/>;
  const buyer = actor === deal.buyer_id;
  const participant = buyer || actor === deal.supplier_id;
  const request = store.getRequest(deal.request_id);
  const offer = store.visibleOffers(deal.request_id).find((o: { id: string }) => o.id === deal.offer_id);
  const offerCount = store.offerCount(deal.request_id);
  const selectedTotal = offer?.priceType === "unit" ? (request?.quantity != null && offer.price != null ? Number(offer.price) * Number(request.quantity) : null) : offer?.priceType === "total" ? offer.price : null;
  const disabled = flow.pending || flow.review;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const deliveryDate = deal.delivery_date || (deal.progress_at && deal.delivery_days != null ? new Date(Date.parse(deal.progress_at) + deal.delivery_days * 86400000).toISOString().slice(0, 10) : null);
  const deliveryDays = deliveryDate ? Math.round((Date.parse(`${deliveryDate}T00:00:00+04:00`) - Date.parse(`${today}T00:00:00+04:00`)) / 86400000) : null;
  const deliveryLabel = deliveryDays == null ? "" : deliveryDays < 0 ? `ვადა გასულია ${Math.abs(deliveryDays)} დღით` : deliveryDays === 0 ? "მიწოდება დღესაა" : `${deliveryDays} დღეში`;
  const change = async (stage: string) => { if (await flow.write("advance_deal", { p_stage: stage })) { setConfirm(null); setEditing(false); } };
  const termsForm = editing && participant && !flow.review && (deal.stage === "discuss" || deal.stage === "terms");
  return <DealShell deal={deal} requestTitle={request?.title || "მოთხოვნა"} buyer={buyer} partner={store.getCompany(buyer ? deal.supplier_id : deal.buyer_id)?.company || store.getCompany(buyer ? deal.supplier_id : deal.buyer_id)?.name || (buyer ? "მომწოდებელი" : "მყიდველი")}
    actions={deal.stage === "selected" && participant ? <Button disabled={disabled} loading={flow.pending} onClick={() => void change("discuss")}><Icon name="message-square"/>ჩატის გახსნა</Button> : deal.stage === "discuss" ? <Button variant="secondary" href={`/requests/view/?id=${deal.request_id}`}>მოთხოვნის ნახვა</Button> : ["terms", "progress", "complete"].includes(deal.stage) ? <Button variant="secondary" href={`/account/?tab=messages${conversationId ? `&c=${encodeURIComponent(conversationId)}` : ""}`}><Icon name="message-square"/>ჩატი</Button> : null}
    aside={<>{["progress", "complete"].includes(deal.stage) ? <DealTermsRecord deal={deal} request={request} compact/> : null}{deal.stage !== "cancelled" || !participant ? <DealContactCard key={`${actor}:${deal.id}:${deal.stage}`} store={store} deal={deal} participant={participant}/> : null}{participant && ["selected", "discuss", "terms"].includes(deal.stage) ? <Button className={styles.cancelAction} variant="ghost" disabled={disabled} onClick={() => setConfirm("cancelled")}>გარიგების გაუქმება</Button> : null}</>}>
    {flow.notice ? <div className={styles.alert} role="alert"><p>{flow.notice}</p>{flow.review ? <Button variant="secondary" onClick={() => { setEditing(false); setReviewing(false); setConfirm(null); flow.reviewed(); }}>განახლებულ პირობებს გავეცანი</Button> : null}</div> : null}
    {!participant ? <p className={styles.note}>ადმინისტრატორის ხედვა — გარიგების მოქმედებებს მხოლოდ მონაწილეები ასრულებენ.</p> : null}
    {detail.error ? <p role="status" className={styles.note}>მოთხოვნის დამატებითი დეტალები ვერ ჩაიტვირთა. გარიგების ჩანაწერი ხელმისაწვდომია.</p> : null}
    {deal.stage === "selected" ? <>

      <section className={styles.card}><header className={styles.cardHead}><h2>არჩეული შეთავაზება</h2><span className="ma-badge ma-badge--success">არჩეული</span></header>
        <dl className={styles.facts}><div><dt>ფასი</dt><dd>{money(selectedTotal ?? deal.total_price)}</dd><small>{offer?.priceType === "unit" ? `${money(offer.price)} / ${units[request?.unit || ""] || request?.unit || "ერთეული"}` : offer?.priceType === "total" ? "ჯამური ფასი" : "დასაზუსტებელია"}</small></div><div><dt>მიწოდება</dt><dd>{deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}</dd><small>{dealDate(deliveryDate)}</small></div><div><dt>ძალაშია</dt><dd>{offer?.validUntil ? dealDate(offer.validUntil) : "—"}</dd></div></dl>
        <ul className={styles.includes}>{[...new Set<string>([...(offer?.commercialTerms?.length ? offer.commercialTerms : deal.includes), ...(offer?.vatIncluded ? ["დღგ ფასში შედის"] : []), ...(offer?.deliveryIncluded ? ["მიწოდება ფასში შედის"] : [])])].map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul>
      </section>
      <section className={styles.card}><h2>რა შეიცვალა</h2><ul className={styles.changes}>
        <li><span><Icon name="lock-keyhole"/></span><div><strong>კონტაქტი და ჩატი ორივე მხარისთვის გაიხსნა</strong><p>{buyer ? "მომწოდებელმაც" : "მყიდველმაც"} მიიღო თქვენი საკონტაქტო მონაცემები.</p></div></li>
        <li><span><Icon name="inbox"/></span><div><strong>{offerCount > 0 ? `დანარჩენი ${offerCount - 1} შეთავაზება` : "დანარჩენი შეთავაზებები"} — „არ შეირჩა“</strong><p>{buyer ? "მომწოდებლებს" : "სხვა მომწოდებლებს"} ავტომატურად ეცნობათ.</p></div></li>
        <li><span><Icon name="ban"/></span><div><strong>მოთხოვნა ახალ შეთავაზებებს აღარ იღებს</strong><p>შესაძლებლობების სიიდან მოიხსნა.</p></div></li>
      </ul></section>

    </> : null}
    {deal.stage === "discuss" && participant ? <><DealDiscussion store={store} deal={deal} actor={actor}/><div className={`${styles.actions} ${styles.discussionActions}`}><Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}><Icon name="pencil"/>ახალი პირობები</Button><Button disabled={disabled} onClick={() => setEditing(true)}><Icon name="check"/>პირობები შეთანხმებულია</Button></div></> : null}
    {deal.stage === "terms" ? <><DealTermsRecord deal={deal} request={request} actions={participant ? <Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}><Icon name="pencil"/>ცვლილების შეთავაზება</Button> : null}/>
      <section className={styles.card}><h2>დადასტურება</h2><p className={styles.note}>პირობების შეცვლა ორივე მხარის თანხმობას აუქმებს. განახლებული პირობები ორივემ ხელახლა უნდა დაადასტუროს.</p><div className={styles.confirmations}>{[["მყიდველი", deal.buyer_confirmed_at], ["მომწოდებელი", deal.supplier_confirmed_at]].map(([label, at]) => <div key={label} className={styles.confirmation} data-confirmed={!!at}><Icon name={at ? "check" : "clock"}/><div><strong>{label}: {at ? "დადასტურდა" : "მოლოდინში"}</strong><small>{at ? dealDate(at) : "საჭიროა დადასტურება"}</small></div></div>)}
      </div>{participant ? <div className={styles.actions}>{!(buyer ? deal.buyer_confirmed_at : deal.supplier_confirmed_at) ? <Button disabled={disabled} loading={flow.pending} onClick={() => void flow.write("confirm_deal_terms")}><Icon name="check"/>პირობების დადასტურება</Button> : null}{deal.buyer_confirmed_at && deal.supplier_confirmed_at ? <Button disabled={disabled} loading={flow.pending} onClick={() => void change("progress")}>შესრულების დაწყება</Button> : <p className={styles.note}>შესრულებისთვის საჭიროა ორივე მხარის თანხმობა.</p>}</div> : null}</section>
    </> : null}
    {termsForm ? <NewTermsModal deal={deal} store={store} pending={disabled} onClose={() => setEditing(false)} onSubmit={args => flow.write("propose_deal_terms", args)}/> : null}
    {deal.stage === "progress" ? <section className={styles.card}><header className={styles.cardHead}><h2>შეკვეთის სტატუსი</h2>{deliveryDate ? <div className={styles.deliveryDue}><Icon name="calendar"/><div><small>მიწოდება</small><strong>{dealDate(deliveryDate)} · {deliveryLabel}</strong></div></div> : null}</header>
      <ol className={styles.timeline}>{deal.events?.map(event => <li key={event.id}><Icon name="check"/><div><strong>{dealActionLabel(event.action)}</strong><small>{dealDate(event.created_at)}</small></div></li>)}</ol>
      {buyer ? <><p className={styles.description}>მიიღე შეკვეთა და ყველაფერი შეთანხმების მიხედვითაა?</p><Button disabled={disabled} onClick={() => setConfirm("complete")}><Icon name="check"/>მიღებულია, დასრულება</Button></> : <p className={styles.note}>მიწოდების შემდეგ დაელოდე მყიდველის დადასტურებას.</p>}</section> : null}
    {deal.stage === "complete" ? <><section className={`${styles.card} ${styles.delivered}`}><span><Icon name="truck"/></span><div><h2>მიწოდებულია</h2><p>{dealDate(deal.complete_at)} · {deal.delivery_place || "—"} · {deal.quantity} {units[deal.unit || ""] || deal.unit}</p></div></section>
      <section className={styles.card}><header className={styles.cardHead}><h2>{deal.rating != null ? "თანამშრომლობის შეფასება" : buyer ? "შეაფასეთ თანამშრომლობა" : "მყიდველის შეფასება"}</h2>{deal.rating == null ? <span className={styles.recordDate}><Icon name="lock-keyhole"/> ინახება დადასტურების შემდეგ</span> : null}</header>{deal.rating != null ? <><div className={styles.ratingStars} aria-label={`${deal.rating} / 5`}>{[1, 2, 3, 4, 5].map(n => <span key={n} data-filled={n <= deal.rating!}><Icon name="star"/></span>)}<strong>{deal.rating} / 5</strong></div><p className={styles.description}>{deal.review}</p></> : buyer ? <div className={styles.reviewAction}><Button disabled={disabled} onClick={() => setReviewing(true)}>შეფასება</Button></div> : <p className={styles.note}>ელოდება მყიდველის შეფასებას.</p>}</section></> : null}
    {participant && ["progress", "complete"].includes(deal.stage) && (buyer || store.getCompany(deal.buyer_id)) ? <section className={`${styles.card} ${styles.issueCard}`}><p>რამე არ შეესაბამება შეთანხმებას?</p><Button variant="secondary" onClick={() => setReporting(true)}><Icon name="triangle-alert"/>პრობლემის შეტყობინება</Button></section> : null}
    {reviewing && buyer && deal.stage === "complete" && deal.rating == null && !flow.review ? <ReviewModal supplier={store.getCompany(deal.supplier_id)?.company || store.getCompany(deal.supplier_id)?.name || "მომწოდებელი"} request={request?.title || "მოთხოვნა"} pending={disabled} onClose={() => setReviewing(false)} onRate={(rating, review) => flow.write("rate_deal", {p_rating: rating, p_review: review})}/> : null}
    {reporting && participant && ["progress", "complete"].includes(deal.stage) ? <ReportIssueModal store={store} kind={buyer ? "offer" : "company"} targetId={buyer ? deal.offer_id : deal.buyer_id} onClose={() => setReporting(false)}/> : null}
    {deal.stage === "cancelled" ? <section className={styles.card}><h2>გარიგება გაუქმებულია</h2><p className={styles.note}>გარიგება მონაწილემ გააუქმა · {dealDate(deal.cancelled_at)}. გაუქმების მიზეზი ჩანაწერში არ ინახება. მოთხოვნა დახურული რჩება.</p><Button href={`/requests/view/?id=${deal.request_id}`} variant="secondary">მოთხოვნის ნახვა</Button></section> : null}


    <ConfirmSheet id="deal-action" open={!!confirm && !flow.review} title={confirm === "complete" ? "გარიგების დასრულება" : "გარიგების გაუქმება"} confirmLabel={confirm === "complete" ? "დასრულების დადასტურება" : "გარიგების გაუქმება"} pendingLabel="ინახება…" pending={flow.pending} danger={confirm === "cancelled"} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void change(confirm)}><p>{confirm === "complete" ? "დაადასტურე, რომ შეკვეთა შეთანხმებული პირობებით მიიღე. დასრულების შემდეგ შეძლებ თანამშრომლობის შეფასებას." : "გარიგება ვეღარ გაგრძელდება. მოთხოვნა დახურული დარჩება და კონტაქტი აღარ გაიხსნება."}</p></ConfirmSheet>
  </DealShell>;
}
