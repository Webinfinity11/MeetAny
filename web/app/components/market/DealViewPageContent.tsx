"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { currentDealTerms, dealDate, money, progressTimeline, useDeal, type Deal } from "../../lib/deal-client";
import type { Conversation } from "../../lib/chat-client";
import { cities, units } from "../../lib/categories";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/Structure";
import { Icon } from "../Icon";
import { NewTermsModal } from "./modals/NewTermsModal";
import { DealProposals, DealUpdates, DealIssues, DealIssueModal } from "./DealCollaboration";
import { ReviewModal } from "./modals/ReviewModal";
import { DealContactCard, DealShell, DealTermsFold, DealTermsRecord } from "./DealShell";
import { DealDiscussion } from "./DealDiscussion";
import { FileAttachments } from "./FileAttachments";
import { DetailSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import styles from "./deals.module.css";

export function DealViewPageContent() {
  const { store, sessionReady, available } = useMarketStore();
  const id = useSearchParams().get("id") || "";
  const me = store?.currentUser();
  if (!id) return <div className={styles.page}><EmptyState icon="handshake" title="გარიგება არ არის მითითებული" text="გახსენით გარიგება თქვენი გარიგებების სიიდან." action={<Button href="/account/?tab=deals">გარიგებები</Button>}/></div>;
  if (!sessionReady) return <DetailSkeleton label="გარიგება იტვირთება…"/>;
  if (!available) return <div className={styles.page}><ServiceUnavailable/></div>;
  if (!me || me.blocked) return <div className={styles.page}><EmptyState icon="lock" title="გარიგებაზე წვდომა შეზღუდულია" text="გარიგებას მხოლოდ მისი მონაწილეები ხედავენ." action={!me ? <Button href={`/account/?next=${encodeURIComponent(`/deals/view/?id=${id}`)}`}>ანგარიშში შესვლა</Button> : undefined}/></div>;
  return <DealWorkspace key={`${me.id}:${id}`} store={store!} id={id} actor={me.id}/>;
}

type Confirm = "agree" | "complete" | "cancelled";
/** Confirmation for consequential deal moves. The secondary button only closes: "დაბრუნება", never an ambiguous "გაუქმება". */
function DealConfirm({ id, open, title, confirmLabel, danger = false, pending, onConfirm, onClose, children }: { id: string; open: boolean; title: string; confirmLabel: string; danger?: boolean; pending: boolean; onConfirm: () => void; onClose: () => void; children: ReactNode }) {
  return <Modal id={id} open={open} width={520} title={title} tone={danger ? "danger" : "neutral"} icon={danger ? "triangle-alert" : "circle-check"} onClose={() => { if (!pending) onClose(); }}
    actions={<><Button variant="secondary" disabled={pending} onClick={onClose}>დაბრუნება</Button><Button variant={danger ? "danger" : "primary"} loading={pending} onClick={onConfirm}>{confirmLabel}</Button></>}>{children}</Modal>;
}

function ProgressTimeline({ deal }: { deal: Deal }) {
  const steps = progressTimeline(deal);
  const current = steps.findLastIndex(step => !!step.at);
  return <ol className={styles.timeline}>{steps.map((step, i) => <li key={step.key} data-done={!!step.at} data-current={i === current && deal.stage !== "complete"}><span className={styles.timelineMark}>{step.at ? <Icon name="check"/> : null}</span><div><strong>{step.label}</strong><small>{step.at ? dealDate(step.at) : "მოლოდინში"}</small></div></li>)}</ol>;
}

function DealWorkspace({ store, id, actor }: { store: Store; id: string; actor: string }) {
  const flow = useDeal(store, id, actor);
  const deal = flow.deal;
  const detail = useRequestDetail(store, !!deal, true, deal?.request_id || "");
  const [reporting, setReporting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [conversationId, setConversationId] = useState<string>();
  const requestId = deal?.request_id, supplierId = deal?.supplier_id;
  useEffect(() => {
    if (!requestId || !supplierId) return;
    let active = true;
    void store.listConversations().then((items: Conversation[]) => { if (active) setConversationId(items.find(c => c.requestId === requestId && c.companyId === supplierId)?.id); }).catch(() => {});
    return () => { active = false; };
  }, [store, requestId, supplierId]);
  if (flow.error) return <div className={styles.page}><EmptyState icon={flow.denied ? "lock" : "circle-alert"} title={flow.denied ? "გარიგებაზე წვდომა შეზღუდულია" : "გარიგება ვერ ჩაიტვირთა"} text={flow.error} role="alert" action={<>{!flow.denied ? <Button variant="secondary" loading={flow.pending} onClick={() => void flow.refresh()}>ხელახლა ცდა</Button> : null}<Button href="/account/?tab=deals" variant="secondary">გარიგებები</Button></>}/></div>;
  if (!deal) return <DetailSkeleton label="გარიგება იტვირთება…"/>;
  const buyer = actor === deal.buyer_id;
  const participant = buyer || actor === deal.supplier_id;
  const request = store.getRequest(deal.request_id);
  const offer = store.visibleOffers(deal.request_id).find((o: { id: string }) => o.id === deal.offer_id);
  const offerCount = store.offerCount(deal.request_id);
  const selectedTotal = offer?.priceType === "unit" ? (request?.quantity != null && offer.price != null ? Number(offer.price) * Number(request.quantity) : null) : offer?.priceType === "total" ? offer.price : null;
  const place = request ? [cities[request.city] || request.city, request.addressNote].filter(Boolean).join(", ") : null;
  const current = currentDealTerms(deal, { totalPrice: selectedTotal, place });
  const partnerProfile = store.userById(buyer ? deal.supplier_id : deal.buyer_id);
  const partner = partnerProfile?.company || partnerProfile?.name || (buyer ? "მომწოდებელი" : "მყიდველი");
  const paused = !!deal.issues?.some(i => i.status === "open");
  const disabled = flow.pending || flow.review;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const deliveryDate = deal.delivery_date || (deal.progress_at && deal.delivery_days != null ? new Date(Date.parse(deal.progress_at) + deal.delivery_days * 86400000).toISOString().slice(0, 10) : null);
  const deliveryDays = deliveryDate ? Math.round((Date.parse(`${deliveryDate}T00:00:00+04:00`) - Date.parse(`${today}T00:00:00+04:00`)) / 86400000) : null;
  const deliveryLabel = deliveryDays == null ? "" : deliveryDays < 0 ? `ვადა გასულია ${Math.abs(deliveryDays)} დღით` : deliveryDays === 0 ? "შესრულება დღესაა" : `${deliveryDays} დღეში`;
  const close = () => { setConfirm(null); setEditing(false); };
  const change = async (stage: string) => { if (await flow.write("advance_deal", { p_stage: stage })) close(); };
  // Accepting keeps the terms as they stand: they move to the record and the accepting side's consent is recorded with them.
  const agree = async () => { if (await flow.write("propose_deal_terms", current.terms)) { close(); await flow.write("confirm_deal_terms"); } };
  const termsForm = editing && participant && !flow.review && (deal.stage === "discuss" || deal.stage === "terms");
  const fixed = ["progress", "complete"].includes(deal.stage);
  const conversationHref = `/account/?tab=messages${conversationId ? `&c=${encodeURIComponent(conversationId)}` : ""}`;
  const rated = deal.rating != null;
  return <DealShell deal={deal} requestTitle={request?.title || "მოთხოვნა"} partner={partner} waiting={deal.stage === "terms" ? participant && !(buyer ? deal.buyer_confirmed_at : deal.supplier_confirmed_at) ? "ელოდება თქვენს დადასტურებას" : !deal.buyer_confirmed_at ? "ელოდება მყიდველის დადასტურებას" : !deal.supplier_confirmed_at ? "ელოდება მომწოდებლის დადასტურებას" : "ორივე მხარემ დაადასტურა" : undefined}
    actions={deal.stage === "selected" && participant ? <Button disabled={disabled} loading={flow.pending} onClick={() => void change("discuss")}><Icon name="message-square"/>ჩატის გახსნა</Button> : deal.stage === "discuss" ? <Button variant="secondary" href={`/requests/view/?id=${deal.request_id}`}>მოთხოვნის ნახვა</Button> : ["terms", "progress", "complete"].includes(deal.stage) ? <Button variant="secondary" href={conversationHref}><Icon name="message-square"/>მიმოწერის გახსნა</Button> : null}
    summary={fixed ? <div className={styles.mobileOnly}><DealTermsFold store={store} deal={deal}/></div> : null}
    aside={<>{fixed ? <div className={styles.desktopOnly}><DealTermsRecord store={store} deal={deal} request={request} compact/></div> : null}{deal.stage !== "cancelled" || !participant ? <DealContactCard key={`${actor}:${deal.id}:${deal.stage}`} store={store} deal={deal} participant={participant}/> : null}{participant && ["selected", "discuss", "terms"].includes(deal.stage) ? <Button className={styles.cancelAction} variant="ghost" disabled={disabled} onClick={() => setConfirm("cancelled")}>გარიგების გაუქმება</Button> : null}</>}>
    {flow.notice ? <div className={styles.alert} role="alert"><p>{flow.notice}</p>{flow.review ? <Button variant="secondary" onClick={() => { setEditing(false); setReviewing(false); setConfirm(null); flow.reviewed(); }}>განახლებულ პირობებს გავეცანი</Button> : null}</div> : null}
    {!participant ? <p className={styles.note}>ადმინისტრატორის ხედვა — გარიგების მოქმედებებს მხოლოდ მონაწილეები ასრულებენ.</p> : null}
    {detail.error ? <p role="status" className={styles.note}>მოთხოვნის დამატებითი დეტალები ვერ ჩაიტვირთა. გარიგების ჩანაწერი ხელმისაწვდომია.</p> : null}

    {deal.stage === "selected" ? <>
      <section className={styles.card}><header className={styles.cardHead}><h2>არჩეული შეთავაზება</h2><span className="ma-badge ma-badge--success">არჩეული</span></header>
        <dl className={styles.facts}><div><dt>ფასი</dt><dd>{money(selectedTotal ?? deal.total_price)}</dd>{offer?.priceType === "unit" ? <small>{money(offer.price)} / {units[request?.unit || ""] || request?.unit || "ერთეული"}</small> : null}</div><div><dt>შესრულების ვადა</dt><dd>{deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}</dd>{deliveryDate ? <small>{dealDate(deliveryDate)}</small> : null}</div>{offer?.validUntil ? <div><dt>შეთავაზება ძალაშია</dt><dd>{dealDate(offer.validUntil)}</dd></div> : null}</dl>
        <ul className={styles.includes}>{[...new Set<string>([...(offer?.commercialTerms?.length ? offer.commercialTerms : deal.includes), ...(offer?.vatIncluded ? ["დღგ ფასში შედის"] : []), ...(offer?.deliveryIncluded ? ["მიწოდება ფასში შედის"] : [])])].map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul>
        <FileAttachments store={store} kind="offer" target={deal.offer_id} label="შეთავაზების ფაილები"/>
      </section>
      <section className={styles.card}><h2>რა შეიცვალა</h2><ul className={styles.changes}>
        <li><span><Icon name="lock-keyhole"/></span><div><strong>კონტაქტი და ჩატი ორივე მხარისთვის გაიხსნა</strong><p>{buyer ? "მომწოდებელმაც" : "მყიდველმაც"} მიიღო თქვენი საკონტაქტო მონაცემები.</p></div></li>
        {offerCount > 1 ? <li><span><Icon name="inbox"/></span><div><strong>დანარჩენი {offerCount - 1} შეთავაზება — „არ შეირჩა“</strong><p>{buyer ? "მომწოდებლებს" : "სხვა მომწოდებლებს"} ავტომატურად ეცნობათ.</p></div></li> : null}
        <li><span><Icon name="ban"/></span><div><strong>მოთხოვნა ახალ შეთავაზებებს აღარ იღებს</strong><p>მოთხოვნა ღია სიიდან მოიხსნა.</p></div></li>
      </ul></section>
    </> : null}

    {deal.stage === "discuss" && participant ? <>
      <section className={`${styles.card} ${styles.currentTerms}`}><header className={styles.cardHead}><h2>მიმდინარე პირობები</h2><span className={styles.recordDate}>არჩეული შეთავაზებიდან</span></header>
        <dl className={styles.currentRows}><div><dt>ფასი</dt><dd>{money(current.terms.p_total_price > 0 ? current.terms.p_total_price : null)}</dd></div><div><dt>რაოდენობა</dt><dd>{deal.quantity == null ? "დასაზუსტებელია" : `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}`}</dd></div><div><dt>შესრულების ვადა</dt><dd>{deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}</dd></div><div><dt>გადახდა</dt><dd>{current.terms.p_payment_terms || "დასაზუსტებელია"}</dd></div></dl>
        {current.missing.length ? <p className={styles.note}>შესათანხმებელია: {current.missing.join(", ")}.</p> : null}
      </section>
      <DealDiscussion store={store} deal={deal} actor={actor}/>
      <div className={`${styles.actions} ${styles.discussionActions}`}><Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}><Icon name="pencil"/>ახალი პირობები</Button><Button disabled={disabled} onClick={() => setConfirm("agree")}><Icon name="check"/>პირობები შეთანხმებულია</Button></div>
    </> : null}

    {!fixed ? <DealProposals deal={deal} actor={actor} write={flow.write} disabled={disabled}/> : null}
    {deal.stage === "terms" ? <><DealTermsRecord store={store} deal={deal} request={request} actions={participant ? <Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}><Icon name="pencil"/>ცვლილების შეთავაზება</Button> : null}/>
      <section className={styles.card}><h2>დადასტურება</h2><p className={styles.note}>პირობების შეცვლა ორივე მხარის თანხმობას აუქმებს. განახლებული პირობები ორივემ ხელახლა უნდა დაადასტუროს.</p><div className={styles.confirmations}>{[["მყიდველი", deal.buyer_confirmed_at], ["მომწოდებელი", deal.supplier_confirmed_at]].map(([label, at]) => <div key={label} className={styles.confirmation} data-confirmed={!!at}><Icon name={at ? "check" : "clock"}/><div><strong>{label}: {at ? "დადასტურებულია" : "მოლოდინში"}</strong><small>{at ? dealDate(at) : "საჭიროა დადასტურება"}</small></div></div>)}
      </div>{participant ? <div className={styles.actions}>{!(buyer ? deal.buyer_confirmed_at : deal.supplier_confirmed_at) ? <Button disabled={disabled} loading={flow.pending} onClick={() => void flow.write("confirm_deal_terms")}><Icon name="check"/>პირობების დადასტურება</Button> : null}{deal.buyer_confirmed_at && deal.supplier_confirmed_at ? <Button disabled={disabled} loading={flow.pending} onClick={() => void change("progress")}>შესრულების დაწყება</Button> : <p className={styles.note}>შესრულებისთვის საჭიროა ორივე მხარის თანხმობა.</p>}</div> : null}</section>
    </> : null}
    {termsForm ? <NewTermsModal deal={deal} defaults={current.terms} store={store} pending={disabled} onClose={() => setEditing(false)} onSubmit={args => flow.write("propose_deal_terms", args)}/> : null}

    {deal.stage === "complete" ? <><section className={`${styles.card} ${styles.delivered}`}><span><Icon name="truck"/></span><div><h2>მიწოდებულია</h2><p>{[dealDate(deal.complete_at), deal.delivery_place, deal.quantity != null ? `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}` : ""].filter(Boolean).join(" · ")}</p></div></section>
      <section className={styles.card}><h2>{rated ? "თანამშრომლობის შეფასება" : buyer ? "შეაფასეთ თანამშრომლობა" : "შეფასება"}</h2>{rated ? <><div className={styles.ratingStars} aria-label={`${deal.rating} / 5`}>{[1, 2, 3, 4, 5].map(n => <span key={n} data-filled={n <= deal.rating!}><Icon name="star"/></span>)}<strong>{deal.rating} / 5</strong></div>{deal.review ? <p className={styles.description}>{deal.review}</p> : null}{deal.review_details ? <dl className={styles.proposalRows}>{["ხარისხი", "ვადების დაცვა", "კომუნიკაცია", "საიმედოობა"].map((label, i) => <div key={label}><dt>{label}</dt><dd>{deal.review_details!.scores[i]} / 5</dd></div>)}<div><dt>კვლავ ითანამშრომლებდით?</dt><dd>{deal.review_details.would_again ? "დიახ" : "არა"}</dd></div></dl> : null}</> : buyer ? <><p className={styles.note}>{partnerProfile?.role === "company" ? "შეფასება გამოჩნდება მომწოდებლის პროფილზე." : "შეფასება შეინახება ამ გარიგებაში."}</p><div className={styles.reviewAction}><Button disabled={disabled || paused} onClick={() => setReviewing(true)}>თანამშრომლობის შეფასება</Button></div></> : <p className={styles.note}>მყიდველს ჯერ არ შეუფასებია.</p>}</section></> : null}
    {fixed ? <section className={styles.card}><header className={styles.cardHead}><h2>შესრულების ეტაპები</h2>{deal.stage === "progress" && deliveryDate ? <div className={styles.deliveryDue}><Icon name="calendar"/><div><small>შესრულების ვადა</small><strong>{dealDate(deliveryDate)} · {deliveryLabel}</strong></div></div> : null}</header>
      <ProgressTimeline deal={deal}/>
      {deal.stage === "progress" ? buyer ? <div className={styles.receive}><p>შეკვეთა მიიღეთ და ყველაფერი შეთანხმების მიხედვითაა?</p><Button disabled={disabled || paused} onClick={() => setConfirm("complete")}><Icon name="check"/>მიღებულია, დასრულება</Button></div> : <p className={styles.note}>მიწოდების შემდეგ მყიდველი დაადასტურებს შეკვეთის მიღებას.</p> : null}
    </section> : null}
    {fixed ? <DealUpdates store={store} deal={deal} supplier={actor === deal.supplier_id} disabled={disabled} write={flow.write}/> : null}
    <DealIssues store={store} deal={deal}/>
    {participant && !paused && fixed ? <section className={`${styles.card} ${styles.issueCard}`}><p>რაიმე არ შეესაბამება შეთანხმებას?</p><Button variant="secondary" onClick={() => setReporting(true)}><Icon name="triangle-alert"/>პრობლემის შეტყობინება</Button></section> : null}
    {reviewing && buyer && deal.stage === "complete" && !rated && !flow.review && !paused ? <ReviewModal supplier={store.userById(deal.supplier_id)?.company || store.userById(deal.supplier_id)?.name || "მომწოდებელი"} request={request?.title || "მოთხოვნა"} pending={disabled} onClose={() => setReviewing(false)} onRate={(_rating, review, details) => flow.write("rate_deal_full", { p_scores: details.scores, p_would_again: details.wouldAgain, p_review: review })}/> : null}
    {reporting && participant && fixed ? <DealIssueModal store={store} deal={deal} disabled={disabled} write={flow.write} onClose={() => setReporting(false)}/> : null}
    {deal.stage === "cancelled" ? <section className={styles.card}><h2>გარიგება გაუქმებულია</h2><p className={styles.note}>გარიგება მონაწილემ გააუქმა · {dealDate(deal.cancelled_at)}. მოთხოვნა დახურული რჩება.</p><div className={styles.actions}><Button href={`/requests/view/?id=${deal.request_id}`} variant="secondary">მოთხოვნის ნახვა</Button>{buyer ? <Button href={`/requests/new/?copy=${encodeURIComponent(deal.request_id)}`}>ახალი მოთხოვნის მომზადება</Button> : null}</div></section> : null}

    <DealConfirm id="deal-agree" open={confirm === "agree" && !flow.review} title="პირობების შეთანხმება" confirmLabel={current.missing.length ? "პირობების შევსება" : "პირობების დადასტურება"} pending={flow.pending} onClose={() => setConfirm(null)} onConfirm={() => { if (current.missing.length) { setConfirm(null); setEditing(true); } else void agree(); }}>
      {current.missing.length ? <p>შეთანხმებამდე შეავსეთ: {current.missing.join(", ")}. დანარჩენი პირობები უცვლელად დარჩება.</p> : <><p>მიმდინარე პირობები გადავა გარიგების ჩანაწერში და თქვენი თანხმობა დაფიქსირდება. შესრულება დაიწყება, როცა {buyer ? "მომწოდებელიც" : "მყიდველიც"} დაადასტურებს.</p>
        <dl className={styles.confirmRows}><div><dt>ფასი</dt><dd>{money(current.terms.p_total_price)}</dd></div><div><dt>შესრულების ვადა</dt><dd>{current.terms.p_delivery_days} დღე</dd></div><div><dt>ადგილი</dt><dd>{current.terms.p_delivery_place}</dd></div><div><dt>გადახდა</dt><dd>{current.terms.p_payment_terms}</dd></div></dl></>}
    </DealConfirm>
    <DealConfirm id="deal-complete" open={confirm === "complete" && !flow.review && !paused} title="შეკვეთის მიღება" confirmLabel="დასრულების დადასტურება" pending={flow.pending} onClose={() => setConfirm(null)} onConfirm={() => void change("complete")}><p>დაადასტურეთ, რომ შეკვეთა შეთანხმებული პირობებით მიიღეთ. დასრულების შემდეგ შეძლებთ თანამშრომლობის შეფასებას.</p></DealConfirm>
    <DealConfirm id="deal-cancel" open={confirm === "cancelled" && !flow.review} danger title="გარიგების გაუქმება" confirmLabel="გარიგების გაუქმება" pending={flow.pending} onClose={() => setConfirm(null)} onConfirm={() => void change("cancelled")}><p>გარიგება ვეღარ გაგრძელდება. მოთხოვნა დახურული დარჩება და კონტაქტი აღარ გაიხსნება. მყიდველი შეძლებს მის საფუძველზე ახალი მოთხოვნის მომზადებას.</p></DealConfirm>
  </DealShell>;
}
