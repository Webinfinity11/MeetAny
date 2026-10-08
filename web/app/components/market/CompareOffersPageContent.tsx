"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { dealDate, dealError, dealHref, flowCode, money, selectOfferDeal, staleReview, type ComparedOffer } from "../../lib/deal-client";
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
import { MessageButton } from "./ChatPopup";
import { ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import styles from "./deals.module.css";

export function CompareOffersPageContent() {
  const { store, sessionReady, available } = useMarketStore();
  const id = useSearchParams().get("id") || "";
  const me = store?.currentUser();
  if (!validRequestId(id)) return <div className={styles.page}><h1>აირჩიე მოთხოვნა შესადარებლად</h1><Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button></div>;
  if (!sessionReady) return <ListSkeleton label="შეთავაზებები იტვირთება…"/>;
  if (!available) return <div className={styles.page}><ServiceUnavailable/></div>;
  if (!me || me.blocked) return <div className={styles.page}><h1>შედარება მხოლოდ მოთხოვნის ავტორისთვისაა</h1>{!me ? <Button href={`/account/?next=${encodeURIComponent(`/requests/compare/?id=${id}`)}`}>ანგარიშში შესვლა</Button> : null}</div>;
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
  return <div className={`${styles.page} ${flowStyles.compare}`}><Link href="/account/?tab=requests" className={styles.back}><Icon name="chevron-left"/>ჩემი მოთხოვნები</Link>
    <header className={styles.header}><div><h1>{request?.title || "შეთავაზებების შედარება"}</h1><p><span className="ma-badge ma-badge--info">შეთავაზებების განხილვა</span> {result?.offers ? `${offers.length} შეთავაზება` : ""}{request?.expiresAt ? ` · მიღება ${dealDate(request.expiresAt)}-მდე` : ""}</p></div><Button href={`/requests/view/?id=${encodeURIComponent(id)}`} variant="secondary">მოთხოვნის ნახვა</Button></header>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}
    {!result ? <ListSkeleton compact label="შეთავაზებები იტვირთება…"/> : result.error ? <section className={styles.card}><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => { setResult(undefined); setRetry(v => v + 1); }}>ხელახლა ცდა</Button></section> : <>
      <div className={flowStyles.filters} role="group" aria-label="შეთავაზებების ფილტრები">{[["price", "ფასი: ზრდადობით"], ["days", "მიწოდება"], ["new", "ახალი"]].map(([value, label]) => <Button key={value} variant={sort === value ? "primary" : "secondary"} aria-pressed={sort === value} onClick={() => { setSort(value === sort && value !== "price" ? "price" : value); setLimit(4); }}>{value === "price" ? <Icon name="arrow-up-down"/> : null}{label}{value !== "price" ? <Icon name="chevron-down"/> : null}</Button>)}<Button variant={verified ? "primary" : "secondary"} aria-pressed={verified} onClick={() => { setVerified(v => !v); setLimit(4); }}>ვერიფიცირებული<Icon name="chevron-down"/></Button><span className={flowStyles.count}>ნაჩვენებია {Math.min(limit, filtered.length)} / {offers.length}</span></div>
      <div className={styles.offerList}>{filtered.slice(0, limit).map(o => <article key={o.id} className={`${styles.card} ${styles.offer} ${flowStyles.offerCard}`}>
        <div className={styles.offerCompany}><div className={styles.identity}><span className={styles.avatar}>{(o.company || "კომპანია").slice(0, 2)}</span><div><h2><Link href={`/companies/view/?id=${o.company_id}`}>{o.company || "კომპანია"}</Link>{o.verified ? <span title="ვერიფიცირებული" aria-label="ვერიფიცირებული"><Icon name="badge-check"/></span> : null}</h2><p className={styles.note}>{cities[o.city] || o.city}{features.data?.find(feature => feature.id === o.company_id && feature.reviewCount > 0)?.rating != null ? <> · ★ {features.data.find(feature => feature.id === o.company_id)?.rating}</> : null}</p></div></div><div className={styles.tags}>{o.created_at && (result.receivedAt || 0) - Date.parse(o.created_at) >= 0 && (result.receivedAt || 0) - Date.parse(o.created_at) < 86400000 ? <Badge tone="new">ახალი</Badge> : null}{o.best_price ? <span className={styles.best}>საუკეთესო ფასი</span> : null}{o.fastest ? <span className={styles.fast}>უსწრაფესი მიწოდება</span> : null}{o.status === "chosen" ? <span>არჩეულია</span> : o.status === "declined" ? <span>არ შეირჩა</span> : !o.eligible ? <span>ვადაგასულია</span> : null}</div></div>
        <dl className={styles.offerFacts}><div><dt>ჯამური ფასი</dt><dd>{money(o.total_gel)}</dd><small>{o.price_type === "unit" ? `${money(o.price)} / ერთეული` : o.price_type === "negotiable" ? "ფასი შეთანხმებით" : request?.quantity > 0 && o.total_gel != null ? `${money(Number(o.total_gel) / request.quantity)} / ერთეული` : "ჯამური ფასი"}</small></div><div><dt>მიწოდება</dt><dd>{o.delivery_days == null ? "დასაზუსტებელია" : `${o.delivery_days} დღე`}</dd></div><div><dt>ძალაშია</dt><dd>{o.valid_until ? dealDate(o.valid_until) : "—"}</dd></div><div className={styles.full}><dt className="ma-sr-only">მოიცავს</dt><dd><ul className={styles.includes}>{o.commercial_terms.map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul></dd><p className={styles.note}>{o.price == null ? "დღგ დასაზუსტებელია" : o.vat_included ? "დღგ ფასში შედის" : "დღგ ფასში არ შედის"} · {o.delivery_included ? "მიწოდება ფასში შედის" : "მიწოდების ხარჯი დასაზუსტებელია"}</p><p className={styles.note}>გადახდა: {o.payment_terms || "დასაზუსტებელია"}</p><OfferDescription body={o.body}/></div></dl>
        <div className={styles.offerActions}>{o.eligible && o.status === "sent" && !request?.chosenOfferId && request && store.requestState(request) === "open" ? <Button disabled={pending || detail.loading} onClick={() => { setError(""); setChoice(o); }}><Icon name="check"/>არჩევა</Button> : o.status === "chosen" ? <Button disabled={pending} onClick={() => { setError(""); void choose(o); }}>გარიგების გახსნა</Button> : null}<MessageButton companyId={o.company_id} requestId={id}/></div>
      </article>)}</div>
      {!filtered.length ? <EmptyState icon="inbox" title={offers.length ? "ამ ფილტრებით შეთავაზება ვერ მოიძებნა" : "შეთავაზებები ჯერ არაა"} text={offers.length ? "შეცვალეთ ფილტრები ყველა შეთავაზების სანახავად." : "მიღებული შეთავაზებები აქ გამოჩნდება."} action={offers.length ? <Button variant="secondary" onClick={() => setVerified(false)}>ფილტრების გასუფთავება</Button> : <Button href={requestLink} variant="secondary">მოთხოვნის ნახვა</Button>}/> : null}
      {filtered.length > limit ? <div className={flowStyles.loadMore}><Button variant="secondary" onClick={() => setLimit(v => v + 4)}>კიდევ {filtered.length - limit} შეთავაზება</Button></div> : null}
      {offers.length ? <p className={`${styles.note} ${styles.center}`}>არჩევის შემდეგ გაიხსნება პარტნიორის კონტაქტი; დანარჩენი შეთავაზებები გადავა „არ შეირჩა“ სტატუსში.</p> : null}
    </>}
    <SelectOfferModal offer={choice} request={request} othersCount={offers.filter(o => o.id !== choice?.id && o.status !== 'declined').length} pending={pending} onConfirm={() => void choose()} onClose={() => { if (!pending) setChoice(null); }}/>

  </div>;
}
