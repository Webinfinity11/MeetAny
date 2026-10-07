"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { useDeal, dealActionLabel, dealDate, money, type Deal } from "../../lib/deal-client";
import { Button } from "../ui/Button";
import { Icon } from "../Icon";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { MessageButton } from "./ChatPopup";
import { DealContactCard, DealShell, DealTermsRecord } from "./DealShell";
import { DealTermsForm } from "./DealTermsForm";
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

const headings = { selected: "მომწოდებელი არჩეულია", discuss: "დეტალების განხილვა", terms: "პირობების დადასტურება", progress: "შესრულება", complete: "გარიგება დასრულებულია", cancelled: "გარიგება გაუქმებულია" };
const leads = { selected: "პარტნიორის კონტაქტი გაიხსნა. დააზუსტეთ დეტალები ჩატში ან დაუკავშირდით პირდაპირ.", discuss: "შეათანხმეთ ფასი, ვადა და პირობები. საბოლოო შეთავაზება ორივე მხარემ უნდა დაადასტუროს.", terms: "გადაამოწმეთ საბოლოო პირობები. ორივე მხარის დადასტურების შემდეგ შეგიძლიათ შესრულების დაწყება.", progress: "შეკვეთის შესრულება დაწყებულია. მიწოდების დეტალები პარტნიორთან მიმოწერაში დააზუსტეთ.", complete: "მყიდველმა დაადასტურა გარიგების დასრულება. შეთანხმებული პირობები და ისტორია შენახულია.", cancelled: "გარიგების გაგრძელება შეუძლებელია. მოთხოვნა ახალ შეთავაზებებს აღარ იღებს." };
function DealWorkspace({ store, id, actor }: { store: Store; id: string; actor: string }) {
  const flow = useDeal(store, id, actor);
  const deal = flow.deal;
  const detail = useRequestDetail(store, !!deal, true, deal?.request_id || "");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"complete" | "cancelled" | null>(null);
  if (flow.error) return <div className={styles.page}><h1>{flow.denied ? "გარიგებაზე წვდომა შეზღუდულია" : "გარიგება ვერ ჩაიტვირთა"}</h1><p role="alert">{flow.error}</p><div className={styles.actions}><Button variant="secondary" loading={flow.pending} onClick={() => void flow.refresh()}>ხელახლა ცდა</Button><Button href="/account/?tab=notifications" variant="secondary">შეტყობინებები</Button></div></div>;
  if (!deal) return <DetailSkeleton label="გარიგება იტვირთება…"/>;
  const buyer = actor === deal.buyer_id;
  const participant = buyer || actor === deal.supplier_id;
  const request = store.getRequest(deal.request_id);
  const offer = store.visibleOffers(deal.request_id).find((o: { id: string }) => o.id === deal.offer_id);
  const selectedTotal = offer?.priceType === "unit" ? (request?.quantity != null && offer.price != null ? Number(offer.price) * Number(request.quantity) : null) : offer?.priceType === "total" ? offer.price : null;
  const disabled = flow.pending || flow.review;
  const change = async (stage: string) => { if (await flow.write("advance_deal", { p_stage: stage })) { setConfirm(null); setEditing(false); } };
  const termsForm = editing && participant && !flow.review && (deal.stage === "discuss" || deal.stage === "terms");
  return <DealShell deal={deal} requestTitle={request?.title || "მოთხოვნა"} title={headings[deal.stage]} lead={leads[deal.stage]}
    actions={<>{participant && deal.stage !== "cancelled" ? <MessageButton companyId={deal.supplier_id} requestId={deal.request_id}/> : null}<Button variant="secondary" disabled={flow.pending} onClick={() => { setEditing(false); void flow.refresh(); }} aria-label="გარიგების განახლება"><Icon name="refresh-cw"/></Button></>}
    aside={<>{["progress", "complete"].includes(deal.stage) ? <DealTermsRecord deal={deal} compact/> : null}<DealContactCard key={`${actor}:${deal.id}:${deal.stage}`} store={store} deal={deal} participant={participant}/></>}>
    {flow.notice ? <div className={styles.alert} role="alert"><p>{flow.notice}</p>{flow.review ? <Button variant="secondary" onClick={() => { setEditing(false); setConfirm(null); flow.reviewed(); }}>განახლებულ პირობებს გავეცანი</Button> : null}</div> : null}
    {!participant ? <p className={styles.note}>ადმინისტრატორის ხედვა — გარიგების მოქმედებებს მხოლოდ მონაწილეები ასრულებენ.</p> : null}
    {detail.error ? <p role="status" className={styles.note}>მოთხოვნის დამატებითი დეტალები ვერ ჩაიტვირთა. გარიგების ჩანაწერი ხელმისაწვდომია.</p> : null}
    {deal.stage === "selected" ? <>
      <section className={styles.card}><header className={styles.cardHead}><h2>არჩეული შეთავაზება</h2><span className="ma-badge ma-badge--success">არჩეული</span></header>
        <dl className={styles.facts}><div><dt>ჯამური ფასი</dt><dd>{money(selectedTotal)}</dd><small>{offer?.priceType === "unit" ? `${money(offer.price)} / ერთეული` : offer?.priceType === "total" ? "ჯამური ფასი" : "დასაზუსტებელია"}</small></div><div><dt>მიწოდება</dt><dd>{deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}</dd></div><div><dt>ძალაშია</dt><dd>{offer?.validUntil ? dealDate(offer.validUntil) : "—"}</dd></div></dl>
        {offer ? <><p className={styles.note}>{offer.price == null ? "ფასი შეთანხმებით" : offer.vatIncluded ? "დღგ ფასში შედის" : "დღგ ფასში არ შედის"} · {offer.deliveryIncluded ? "მიწოდება ფასში შედის" : "მიწოდების ხარჯი დასაზუსტებელია"}</p><p className={styles.description}>{offer.body}</p></> : <p className={styles.note}>არჩეული შეთავაზების ფასი და აღწერა მოთხოვნის გვერდზეც ხელმისაწვდომია.</p>}
        {deal.includes.length ? <ul className={styles.includes}>{deal.includes.map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul> : null}
        {participant ? <Button loading={flow.pending} disabled={disabled} onClick={() => void change("discuss")}>დეტალების განხილვა</Button> : null}
      </section>
      <section className={styles.card}><h2>რა შეიცვალა</h2><ul className={styles.changes}><li><Icon name="lock"/><div><strong>კონტაქტი ორივე მხარისთვის გაიხსნა</strong><p>პარტნიორის მონაცემები გარიგების მონაწილეებისთვის ხელმისაწვდომია.</p></div></li><li><Icon name="inbox"/><div><strong>დანარჩენი შეთავაზებები — „არ შეირჩა“</strong><p>არჩეული მომწოდებელი დაფიქსირებულია.</p></div></li><li><Icon name="ban"/><div><strong>მოთხოვნა ახალ შეთავაზებებს აღარ იღებს</strong><p>შემდეგი ნაბიჯია საბოლოო პირობების შეთანხმება.</p></div></li></ul></section>
    </> : null}
    {deal.stage === "discuss" ? <>{participant ? <DealDiscussion store={store} deal={deal} actor={actor}/> : null}{!termsForm ? <section className={styles.card}><h2>საბოლოო პირობები</h2><p className={styles.note}>ჩატში შეთანხმებული ფასი, რაოდენობა და მიწოდება გარიგების ჩანაწერში შეინახეთ.</p>{participant ? <Button disabled={disabled} onClick={() => setEditing(true)}>პირობების შეთავაზება</Button> : null}</section> : null}</> : null}
    {deal.stage === "terms" && !termsForm ? <><DealTermsRecord deal={deal} actions={participant ? <Button variant="secondary" disabled={disabled} onClick={() => setEditing(true)}><Icon name="pencil"/>ცვლილების შეთავაზება</Button> : null}/>
      <section className={styles.card}><h2>დადასტურება</h2><div className={styles.confirmations}>{[["მყიდველი", deal.buyer_confirmed_at], ["მომწოდებელი", deal.supplier_confirmed_at]].map(([label, at]) => <div key={label} className={styles.confirmation} data-confirmed={!!at}><Icon name={at ? "check" : "clock"}/><div><strong>{label}: {at ? "დადასტურდა" : "მოლოდინში"}</strong><small>{at ? dealDate(at) : "საჭიროა დადასტურება"}</small></div></div>)}
      </div>{participant ? <div className={styles.actions}>{!(buyer ? deal.buyer_confirmed_at : deal.supplier_confirmed_at) ? <Button disabled={disabled} loading={flow.pending} onClick={() => void flow.write("confirm_deal_terms")}><Icon name="check"/>პირობების დადასტურება</Button> : null}{deal.buyer_confirmed_at && deal.supplier_confirmed_at ? <Button disabled={disabled} loading={flow.pending} onClick={() => void change("progress")}>შესრულების დაწყება</Button> : <p className={styles.note}>შესრულებისთვის საჭიროა ორივე მხარის თანხმობა.</p>}</div> : null}</section>
    </> : null}
    {termsForm ? <DealTermsForm key={deal.revision} deal={deal} pending={disabled} onCancel={() => setEditing(false)} onSubmit={async args => { const ok = await flow.write("propose_deal_terms", args); if (ok) setEditing(false); return ok; }}/> : null}
    {deal.stage === "progress" ? <section className={styles.card}><header className={styles.cardHead}><h2>შეკვეთის სტატუსი</h2>{deal.delivery_date ? <p className={styles.success}>მიწოდება · {dealDate(deal.delivery_date)}</p> : null}</header><p className={styles.note}>შესრულება დაიწყო {dealDate(deal.progress_at)}. დასრულებას მყიდველი ადასტურებს.</p>{buyer ? <><p className={styles.description}>მიიღე შეკვეთა და ყველაფერი შეთანხმების მიხედვითაა?</p><Button disabled={disabled} onClick={() => setConfirm("complete")}><Icon name="check"/>დიახ, დასრულებულია</Button></> : <p className={styles.note}>მიწოდების შემდეგ დაელოდე მყიდველის დადასტურებას.</p>}</section> : null}
    {deal.stage === "complete" ? <><section className={styles.card}><h2><Icon name="circle-check"/> გარიგება დასრულებულია</h2><p className={styles.note}>მყიდველმა დაადასტურა · {dealDate(deal.complete_at)}</p></section><DealRating key={deal.revision} deal={deal} buyer={buyer} pending={disabled} onRate={(rating, review) => flow.write("rate_deal", { p_rating: rating, p_review: review })}/></> : null}
    {deal.stage === "cancelled" ? <section className={styles.card}><h2>გარიგება გაუქმებულია</h2><p className={styles.note}>გაუქმება მოთხოვნას ხელახლა არ ხსნის და სხვა შეთავაზებების არჩევას არ აღადგენს.</p><Button href={`/requests/view/?id=${deal.request_id}`} variant="secondary">მოთხოვნის ნახვა</Button></section> : null}
    {deal.stage !== "selected" ? <section className={styles.card}><details open={deal.stage === "progress"}><summary>გარიგების ისტორია</summary><ol className={styles.timeline}>{deal.events?.map(event => <li key={event.id}><Icon name="check"/><div><strong>{dealActionLabel(event.action)}</strong><small>{event.actor_id === deal.buyer_id ? "მყიდველი" : "მომწოდებელი"} · {dealDate(event.created_at)}</small></div></li>)}</ol></details></section> : null}
    {participant && ["selected", "discuss", "terms"].includes(deal.stage) ? <div><Button variant="danger-quiet" disabled={disabled} onClick={() => setConfirm("cancelled")}>გარიგების გაუქმება</Button></div> : null}
    <ConfirmSheet id="deal-action" open={!!confirm && !flow.review} title={confirm === "complete" ? "გარიგების დასრულება" : "გარიგების გაუქმება"} confirmLabel={confirm === "complete" ? "დასრულების დადასტურება" : "გარიგების გაუქმება"} pendingLabel="ინახება…" pending={flow.pending} danger={confirm === "cancelled"} onCancel={() => setConfirm(null)} onConfirm={() => confirm && void change(confirm)}><p>{confirm === "complete" ? "დაადასტურე, რომ შეკვეთა შეთანხმებული პირობებით მიიღე. დასრულების შემდეგ შეძლებ თანამშრომლობის შეფასებას." : "გარიგება ვეღარ გაგრძელდება. მოთხოვნა დახურული დარჩება და კონტაქტი აღარ გაიხსნება."}</p></ConfirmSheet>
  </DealShell>;
}
function DealRating({ deal, buyer, pending, onRate }: { deal: Deal; buyer: boolean; pending: boolean; onRate: (rating: number, review: string) => Promise<boolean> }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  return <section className={styles.card}><h2>შეაფასე თანამშრომლობა</h2>{deal.rating != null ? <><p className={styles.description}>შეფასება: {deal.rating} / 5</p>{deal.review ? <p>{deal.review}</p> : null}</> : buyer ? <form className={styles.form} onSubmit={async e => { e.preventDefault(); if (rating) await onRate(rating, review); }}><fieldset disabled={pending}><legend className="ma-sr-only">საერთო შეფასება</legend><div className={styles.stars}>{[1, 2, 3, 4, 5].map(n => <label key={n}><input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} required aria-label={`${n} ვარსკვლავი`}/>{n}<Icon name="star"/></label>)}</div><label>კომენტარი (არასავალდებულო)<textarea className="ma-textarea" maxLength={2000} value={review} onChange={e => setReview(e.target.value)}/></label></fieldset><p className={styles.note}>შეფასება ინახება ამ გარიგებაში და საჯარო პროფილზე არ ქვეყნდება. გაგზავნა შესაძლებელია ერთხელ.</p><Button type="submit" disabled={pending || !rating} loading={pending}>შეფასების გაგზავნა</Button></form> : <p className={styles.note}>შეფასებას მყიდველი ტოვებს.</p>}</section>;
}
