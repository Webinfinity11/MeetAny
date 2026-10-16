"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { dealDate, dealError, dealHref, flowCode, money, offerStatusLabel, selectOfferDeal, staleReview, useRequestDeal, type ComparedOffer } from "../../lib/deal-client";
import { useCompanyFeatures } from "../../lib/business-client";
import { cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/Structure";
import { Badge } from "../ui/Badge";
import { toast } from "../Toasts";
import { validRequestId } from "../../lib/matching-client";
import { OfferDescription } from "./offer/OfferDescription";
import flowStyles from "./offer/OfferFlow.module.css";
import { SelectOfferModal } from "./modals/SelectOfferModal";
import { FileAttachments } from "./FileAttachments";
import { MessageButton } from "./ChatPopup";
import { CompanyAvatar } from "./CompanyAvatar";
import { ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import styles from "./deals.module.css";

export function CompareOffersPageContent() {
  const { store, sessionReady, available } = useMarketStore();
  const id = useSearchParams().get("id") || "";
  const me = store?.currentUser();
  if (!validRequestId(id)) return <div className={styles.page}><EmptyState icon="inbox" title="მოთხოვნა არ არის მითითებული" text="შესადარებლად გახსენით მოთხოვნა თქვენი მოთხოვნების სიიდან." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/></div>;
  if (!sessionReady) return <ListSkeleton label="შეთავაზებები იტვირთება…"/>;
  if (!available) return <div className={styles.page}><ServiceUnavailable/></div>;
  if (!me || me.blocked) return <div className={styles.page}><EmptyState icon="lock" title="შედარება მხოლოდ მოთხოვნის ავტორისთვისაა" text="შეთავაზებებს მხოლოდ მოთხოვნის ავტორი ადარებს." action={!me ? <Button href={`/account/?next=${encodeURIComponent(`/requests/compare/?id=${id}`)}`}>ანგარიშში შესვლა</Button> : undefined}/></div>;
  return <CompareOffers key={`${me.id}:${id}`} store={store!} id={id}/>;
}
function CompareOffers({ store, id }: { store: Store; id: string }) {
  const router = useRouter();
  const call = store.callRpc;
  const features = useCompanyFeatures(store, true);
  const detail = useRequestDetail(store, true, true, id);
  const [result, setResult] = useState<{ offers?: ComparedOffer[]; error?: string; receivedAt?: number }>();
  const [retry, setRetry] = useState(0);
  const [choice, setChoice] = useState<ComparedOffer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [sort, setSort] = useState("price");
  const [verified, setVerified] = useState(false);
  const [limit, setLimit] = useState(4);
  const request = store.getRequest(id);
  const ownerId = request?.ownerId;
  const actorId = store.currentUser()?.id;
  const chosen = !!request?.chosenOfferId;
  // An existing deal is opened by link; only a chosen offer without a deal record needs the explicit write.
  const dealId = useRequestDeal(store, id, chosen && !!ownerId && ownerId === actorId);
  useEffect(() => {
    if (detail.loading || detail.error || !ownerId || ownerId !== actorId) return;
    let active = true;
    void call("compare_offers", { p_request_id: id }).then((offers: ComparedOffer[]) => { if (active) setResult({ offers, receivedAt: Date.now() }); }, (err: unknown) => { if (active) setResult({ error: flowCode(err) === "MA901" ? "შედარება მხოლოდ მოთხოვნის ავტორისთვისაა ხელმისაწვდომი." : dealError(err) }); });
    return () => { active = false; };
  }, [call, id, retry, detail.loading, detail.error, ownerId, actorId]);
  async function choose(selected = choice) {
    if (!selected || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { const deal = await selectOfferDeal(store, selected.id, selected.updated_at); toast({ title: "მომწოდებელი არჩეულია", tone: "success" }); router.push(dealHref(deal.id)); }
    catch (err) {
      setChoice(null); setError(flowCode(err) === "MA904" ? staleReview : dealError(err));
      // Close the sheet and force a new explicit choice from the reread server comparison.
      setResult(undefined); setRetry(v => v + 1); void store.ensureRequest(id).catch(() => undefined);
    } finally { busy.current = false; setPending(false); }
  }
  const offers = result?.offers || [];
  const filtered = offers.filter(o => !verified || o.verified).sort((a, b) => sort === "new" ? Date.parse(b.created_at || b.updated_at) - Date.parse(a.created_at || a.updated_at) : sort === "days" ? (a.delivery_days ?? Infinity) - (b.delivery_days ?? Infinity) : (a.total_gel == null ? Infinity : Number(a.total_gel)) - (b.total_gel == null ? Infinity : Number(b.total_gel)));
  const requestLink = `/requests/view/?id=${encodeURIComponent(id)}`;
  if (detail.error) return <div className={styles.page}><EmptyState icon="circle-alert" title="მოთხოვნა ვერ ჩაიტვირთა" text="სცადეთ ხელახლა." action={<Button onClick={() => window.location.reload()}>ხელახლა ცდა</Button>}/></div>;
  if (!detail.loading && (!request || ownerId !== actorId)) return <div className={styles.page}><EmptyState icon="lock" title="შედარება მიუწვდომელია" text="შეთავაზებებს მხოლოდ მოთხოვნის მფლობელი ხედავს." action={<Button href={requestLink}>მოთხოვნის ნახვა</Button>}/></div>;
  return <div className={`${styles.page} ${flowStyles.compare} ${styles.compare}`}><Link href="/account/?tab=requests" className={styles.back}><Icon name="chevron-left"/>ჩემი მოთხოვნები</Link>
    <header className={styles.header}><div><h1>{request?.title || "შეთავაზებების შედარება"}</h1><p>{result?.offers ? `${offers.length} შეთავაზება` : "შეთავაზებების შედარება"}{request?.expiresAt && !chosen ? ` · მიღება სრულდება ${dealDate(request.expiresAt)}` : ""}</p></div><div className={styles.actions}>{chosen && dealId ? <Button href={dealHref(dealId)}><Icon name="handshake"/>გარიგების გახსნა</Button> : null}<Button href={requestLink} variant="secondary">მოთხოვნის ნახვა</Button></div></header>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}
    {!result ? <ListSkeleton compact label="შეთავაზებები იტვირთება…"/> : result.error ? <section className={styles.card}><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => { setResult(undefined); setRetry(v => v + 1); }}>ხელახლა ცდა</Button></section> : <>
      <div className={flowStyles.filters} role="group" aria-label="შეთავაზებების ფილტრები">{[["price", "თანხით ზრდადობით"], ["days", "მოკლე ვადა"], ["new", "ახალი ჯერ"]].map(([value, label]) => <Button key={value} variant={sort === value ? "primary" : "secondary"} aria-pressed={sort === value} onClick={() => { setSort(value === sort && value !== "price" ? "price" : value); setLimit(4); }}>{value === "price" ? <Icon name="arrow-up-down"/> : null}{label}</Button>)}<Button variant={verified ? "primary" : "secondary"} aria-pressed={verified} onClick={() => { setVerified(v => !v); setLimit(4); }}>{verified ? <Icon name="check"/> : null}ვერიფიცირებული</Button><span className={flowStyles.count}>ნაჩვენებია {Math.min(limit, filtered.length)} / {offers.length}</span></div>
      {offers.length ? <p className={styles.note}>შეადარეთ ჯამები. დღგ და მიწოდება გადაამოწმეთ; საბოლოო თანხას ორივე მხარე ადასტურებს.</p> : null}
      {filtered.length ? <details className={styles.comparisonFold}><summary>ცხრილით შედარება</summary><div className={styles.comparisonScroll} role="region" aria-label="შეთავაზებების შედარების ცხრილი" tabIndex={0}><table className={styles.comparisonTable}><caption>ფასი, ვადა და გადახდის პირობები</caption><thead><tr><th scope="col">მომწოდებელი</th>{filtered.slice(0, limit).map(o => <th key={o.id} scope="col">{o.supplier_role === "client" ? o.company || "მომწოდებელი" : <Link href={`/companies/view/?id=${o.company_id}`}>{o.company || "მომწოდებელი"}</Link>}</th>)}</tr></thead><tbody>
        <tr><th scope="row">ფასი</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.price_type === "unit" && o.total_gel == null ? "ჯამი დასაზუსტებელია" : money(o.total_gel)}</td>)}</tr>
        <tr><th scope="row">დღგ</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.price == null ? "დასაზუსტებელია" : o.vat_included ? "ფასში შედის" : "ფასში არ შედის"}</td>)}</tr>
        <tr><th scope="row">მიწოდების ხარჯი</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.delivery_included ? "ფასში შედის" : "დასაზუსტებელია"}</td>)}</tr>
        <tr><th scope="row">ვადა</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.delivery_days == null ? "დასაზუსტებელია" : `${o.delivery_days} დღე`}</td>)}</tr>
        <tr><th scope="row">გადახდა</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.payment_terms || "დასაზუსტებელია"}</td>)}</tr>
        <tr><th scope="row">ვერიფიკაცია</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{o.verified ? "ვერიფიცირებული" : "არ არის ვერიფიცირებული"}</td>)}</tr>
        <tr><th scope="row">არჩევა</th>{filtered.slice(0, limit).map(o => <td key={o.id}>{!chosen && o.eligible ? <Button disabled={pending} onClick={() => setChoice(o)}>არჩევა</Button> : offerStatusLabel(o.status)}</td>)}</tr>
      </tbody></table></div></details> : null}
      <div className={styles.offerList}>{filtered.slice(0, limit).map(o => <article key={o.id} className={`${styles.card} ${styles.offer} ${flowStyles.offerCard}`}>
        <div className={styles.offerCompany}><div className={styles.identity}><CompanyAvatar name={o.company || "მომწოდებელი"}/><div><h2>{o.supplier_role === "client" ? o.company || "მომწოდებელი" : <Link href={`/companies/view/?id=${o.company_id}`}>{o.company || "მომწოდებელი"}</Link>}{o.verified ? <span role="img" title="ვერიფიცირებული" aria-label="ვერიფიცირებული"><Icon name="badge-check"/></span> : null}</h2><p className={styles.note}>{cities[o.city] || o.city}{features.data?.find(feature => feature.id === o.company_id && feature.reviewCount > 0)?.rating != null ? <> · ★ {features.data.find(feature => feature.id === o.company_id)?.rating}</> : null}</p></div></div><div className={styles.tags}>{o.created_at && (result.receivedAt || 0) - Date.parse(o.created_at) >= 0 && (result.receivedAt || 0) - Date.parse(o.created_at) < 86400000 ? <Badge tone="new">ახალი</Badge> : null}{o.best_price ? <span className={styles.best}>ყველაზე დაბალი მითითებული თანხა</span> : null}{o.fastest ? <span className={styles.fast}>უმოკლესი ვადა</span> : null}{o.status === "chosen" ? <span className={styles.best}>{offerStatusLabel("chosen")}</span> : o.status === "declined" ? <span>{offerStatusLabel("declined")}</span> : !o.eligible ? <span>ვადაგასულია</span> : null}</div></div>
        <div className={styles.offerDetails}><dl className={styles.offerFacts}>
          <div><dt>მითითებული ჯამი</dt><dd>{o.price_type === "unit" && o.total_gel == null ? "ჯამი დასაზუსტებელია" : money(o.total_gel)}{o.price_type === "unit" && o.price != null ? <small>{money(o.price)} / ერთეული</small> : o.price_type === "total" && request?.quantity > 0 && o.total_gel != null ? <small>{money(Number(o.total_gel) / request.quantity)} / ერთეული</small> : null}</dd></div>
          <div><dt>შესრულების ვადა</dt><dd>{o.delivery_days == null ? "დასაზუსტებელია" : `${o.delivery_days} დღე`}</dd></div>
          {o.valid_until ? <div><dt>ძალაშია</dt><dd>{dealDate(o.valid_until)}</dd></div> : null}
        </dl>
          {o.commercial_terms.length ? <ul className={styles.includes}>{o.commercial_terms.map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul> : null}
          <p className={styles.note}>{offerNotes(o)}</p><OfferDescription body={o.body}/><FileAttachments store={store} kind="offer" target={o.id}/>
        </div>
        <div className={styles.offerActions}>{o.eligible && o.status === "sent" && !request?.chosenOfferId && request && store.requestState(request) === "open" ? <Button disabled={pending || detail.loading} onClick={() => { setError(""); setChoice(o); }}><Icon name="check"/>შეთავაზების არჩევა</Button> : o.status === "chosen" ? dealId ? <Button href={dealHref(dealId)}>გარიგების გახსნა</Button> : dealId === null ? <Button variant="secondary" loading={pending} onClick={() => { setError(""); void choose(o); }}>გარიგების ჩანაწერის შექმნა</Button> : null : null}<MessageButton companyId={o.company_id} requestId={id}/></div>
      </article>)}</div>
      {!filtered.length ? <EmptyState icon="inbox" title={offers.length ? "ამ ფილტრებით შეთავაზება ვერ მოიძებნა" : "შეთავაზებები ჯერ არ არის"} text={offers.length ? "შეცვალეთ ფილტრები ყველა შეთავაზების სანახავად." : "მიღებული შეთავაზებები აქ გამოჩნდება."} action={offers.length ? <Button variant="secondary" onClick={() => setVerified(false)}>ფილტრების გასუფთავება</Button> : <Button href={requestLink} variant="secondary">მოთხოვნის ნახვა</Button>}/> : null}
      {filtered.length > limit ? <div className={flowStyles.loadMore}><Button variant="secondary" onClick={() => setLimit(v => v + 4)}>კიდევ {filtered.length - limit} შეთავაზება</Button></div> : null}
      {offers.length ? <p className={`${styles.note} ${styles.center}`}>არჩევის შემდეგ გაიხსნება პარტნიორის კონტაქტი; დანარჩენი შეთავაზებები გადავა „არ შეირჩა“ სტატუსში.</p> : null}
    </>}
    <SelectOfferModal offer={choice ? { company: choice.company, verified: choice.verified, total: choice.total_gel, priceLabel: choice.price_type === "unit" && choice.total_gel == null ? `${money(choice.price)} / ერთეული · ჯამი დასაზუსტებელია` : undefined, deliveryDays: choice.delivery_days } : null} request={request} othersCount={offers.filter(o => o.id !== choice?.id && o.status !== 'declined').length} pending={pending} onConfirm={() => void choose()} onClose={() => { if (!pending) setChoice(null); }}/>

  </div>;
}

/** VAT, delivery cost and payment as one line; unknowns are grouped instead of repeated. */
function offerNotes(o: ComparedOffer) {
  const known = [o.price != null ? o.vat_included ? "დღგ ფასში შედის" : "დღგ ფასში არ შედის" : "", o.delivery_included ? "მიწოდება ფასში შედის" : "", o.payment_terms ? `გადახდა: ${o.payment_terms}` : ""].filter(Boolean);
  const open = [o.price == null ? "დღგ" : "", o.delivery_included ? "" : "მიწოდების ხარჯი", o.payment_terms ? "" : "გადახდა"].filter(Boolean);
  return [...known, open.length ? `${open.join(", ")} — დასაზუსტებელი` : ""].filter(Boolean).join(" · ");
}
