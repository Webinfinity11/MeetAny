"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMarketStore, type Store } from "../../lib/market-client";
import { useRequestDetail } from "../../lib/use-request-detail";
import { dealDate, dealError, dealHref, flowCode, money, selectOfferDeal, staleReview, type ComparedOffer } from "../../lib/deal-client";
import { cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import { ChooseOfferSheet } from "./ChooseOfferSheet";
import { MessageButton } from "./ChatPopup";
import { ListSkeleton } from "./Skeletons";
import { ServiceUnavailable } from "./ServiceUnavailable";
import styles from "./deals.module.css";

export function CompareOffersPageContent() {
  const { store, sessionReady, available } = useMarketStore();
  const id = useSearchParams().get("id") || "";
  const me = store?.currentUser();
  if (!id) return <div className={styles.page}><h1>აირჩიე მოთხოვნა შესადარებლად</h1><Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button></div>;
  if (!sessionReady) return <ListSkeleton label="შეთავაზებები იტვირთება…"/>;
  if (!available) return <div className={styles.page}><ServiceUnavailable/></div>;
  if (!me || me.blocked) return <div className={styles.page}><h1>შედარება მხოლოდ მოთხოვნის ავტორისთვისაა</h1>{!me ? <Button href={`/account/?next=${encodeURIComponent(`/requests/compare/?id=${id}`)}`}>ანგარიშში შესვლა</Button> : null}</div>;
  return <CompareOffers key={`${me.id}:${id}`} store={store!} id={id}/>;
}
function CompareOffers({ store, id }: { store: Store; id: string }) {
  const router = useRouter();
  const call = store.callRpc;
  const detail = useRequestDetail(store, true, true, id);
  const [result, setResult] = useState<{ offers?: ComparedOffer[]; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [choice, setChoice] = useState<ComparedOffer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [sort, setSort] = useState("price");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDays, setMaxDays] = useState("");
  const [verified, setVerified] = useState(false);
  const [limit, setLimit] = useState(4);
  useEffect(() => {
    let active = true;
    void call("compare_offers", { p_request_id: id }).then((offers: ComparedOffer[]) => { if (active) setResult({ offers }); }, (err: unknown) => { if (active) setResult({ error: flowCode(err) === "MA901" ? "შედარება მხოლოდ მოთხოვნის ავტორისთვისაა ხელმისაწვდომი." : dealError(err) }); });
    return () => { active = false; };
  }, [call, id, retry]);
  async function choose() {
    if (!choice || busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { const deal = await selectOfferDeal(store, choice.id, choice.updated_at); router.push(dealHref(deal.id)); }
    catch (err) {
      setChoice(null); setError(flowCode(err) === "MA904" ? staleReview : dealError(err));
      // Close the sheet and force a new explicit choice from the reread server comparison.
      setResult(undefined); setRetry(v => v + 1); void store.ensureRequest(id).catch(() => undefined);
    } finally { busy.current = false; setPending(false); }
  }
  const request = store.getRequest(id);
  const offers = result?.offers || [];
  const filtered = offers.filter(o => (!verified || o.verified) && (!maxPrice || (o.total_gel != null && Number(o.total_gel) <= Number(maxPrice))) && (!maxDays || (o.delivery_days != null && o.delivery_days <= Number(maxDays)))).sort((a, b) => sort === "days" ? (a.delivery_days ?? Infinity) - (b.delivery_days ?? Infinity) : (a.total_gel == null ? Infinity : Number(a.total_gel)) - (b.total_gel == null ? Infinity : Number(b.total_gel)));
  return <div className={styles.page}><Link href="/account/?tab=requests" className={styles.back}><Icon name="chevron-left"/>ჩემი მოთხოვნები</Link>
    <header className={styles.header}><div><h1>{request?.title || "შეთავაზებების შედარება"}</h1><p><span className="ma-badge ma-badge--info">შეთავაზებების განხილვა</span> {result?.offers ? `${offers.length} შეთავაზება` : ""}</p></div><Button href={`/requests/view/?id=${encodeURIComponent(id)}`} variant="secondary">მოთხოვნის ნახვა</Button></header>
    {error ? <p className={styles.alert} role="alert">{error}</p> : null}
    {!result ? <ListSkeleton compact label="შეთავაზებები იტვირთება…"/> : result.error ? <section className={styles.card}><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => { setResult(undefined); setRetry(v => v + 1); }}>ხელახლა ცდა</Button></section> : <>
      <div className={styles.filters}><label><span className="ma-sr-only">დალაგება</span><CustomSelect value={sort} onChange={e => setSort(e.target.value)}><option value="price">ფასი: ზრდადობით</option><option value="days">მიწოდება: უსწრაფესი</option></CustomSelect></label><label>ფასი ≤<input className="ma-input" type="number" min="0" value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setLimit(4); }} aria-label="მაქსიმალური ფასი"/></label><label>დღე ≤<input className="ma-input" type="number" min="0" max="365" value={maxDays} onChange={e => { setMaxDays(e.target.value); setLimit(4); }} aria-label="მაქსიმალური მიწოდების დღე"/></label><label><input type="checkbox" checked={verified} onChange={e => { setVerified(e.target.checked); setLimit(4); }}/>მხოლოდ ვერიფიცირებული</label><span className={styles.note}>ნაჩვენებია {Math.min(limit, filtered.length)} / {filtered.length}</span></div>
      <div className={styles.offerList}>{filtered.slice(0, limit).map(o => <article key={o.id} className={`${styles.card} ${styles.offer}`}>
        <div className={styles.offerCompany}><div className={styles.identity}><span className={styles.avatar}>{(o.company || "კომპანია").slice(0, 2)}</span><div><h2><Link href={`/companies/view/?id=${o.company_id}`}>{o.company || "კომპანია"}</Link>{o.verified ? <span title="ვერიფიცირებული" aria-label="ვერიფიცირებული"> ✓</span> : null}</h2><p className={styles.note}>{cities[o.city] || o.city}</p></div></div><div className={styles.tags}>{o.best_price ? <span className={styles.best}>საუკეთესო ფასი</span> : null}{o.fastest ? <span className={styles.fast}>უსწრაფესი მიწოდება</span> : null}{o.status === "chosen" ? <span>არჩეულია</span> : o.status === "declined" ? <span>არ შეირჩა</span> : !o.eligible ? <span>ვადაგასულია</span> : null}</div></div>
        <dl className={styles.offerFacts}><div><dt>ჯამური ფასი</dt><dd>{money(o.total_gel)}</dd><small>{o.price_type === "unit" ? `${money(o.price)} / ერთეული` : o.price_type === "negotiable" ? "ფასი შეთანხმებით" : "ჯამური ფასი"}</small></div><div><dt>მიწოდება</dt><dd>{o.delivery_days == null ? "დასაზუსტებელია" : `${o.delivery_days} დღე`}</dd></div><div><dt>ძალაშია</dt><dd>{o.valid_until ? dealDate(o.valid_until) : "—"}</dd></div><div className={styles.full}><dt className="ma-sr-only">მოიცავს</dt><dd><ul className={styles.includes}>{o.commercial_terms.map((t, i) => <li key={i}><Icon name="check"/>{t}</li>)}</ul></dd><p className={styles.note}>{o.price == null ? "დღგ დასაზუსტებელია" : o.vat_included ? "დღგ ფასში შედის" : "დღგ ფასში არ შედის"} · {o.delivery_included ? "მიწოდება ფასში შედის" : "მიწოდების ხარჯი დასაზუსტებელია"}</p><details className={styles.note}><summary>სრული პირობები</summary><p className={styles.description}>{o.body}</p>{o.payment_terms ? <p>გადახდა: {o.payment_terms}</p> : null}</details></div></dl>
        <div className={styles.offerActions}>{o.eligible && o.status === "sent" && !request?.chosenOfferId && request && store.requestState(request) === "open" ? <Button disabled={pending || detail.loading} onClick={() => { setError(""); setChoice(o); }}>არჩევა</Button> : o.status === "chosen" ? <Button disabled={pending} onClick={() => { setError(""); setChoice(o); }}>გარიგების გახსნა</Button> : null}<MessageButton companyId={o.company_id} requestId={id}/></div>
      </article>)}</div>
      {!filtered.length ? <section className={styles.card}><h2>{offers.length ? "ამ ფილტრებით შეთავაზება ვერ მოიძებნა" : "შეთავაზებები ჯერ არ არის"}</h2>{offers.length ? <Button variant="secondary" onClick={() => { setMaxPrice(""); setMaxDays(""); setVerified(false); }}>ფილტრების გასუფთავება</Button> : null}</section> : null}
      {filtered.length > limit ? <div className={styles.center}><Button variant="secondary" onClick={() => setLimit(v => v + 4)}>მეტი შეთავაზება ({filtered.length - limit})</Button></div> : null}
      <p className={`${styles.note} ${styles.center}`}>არჩევის შემდეგ გაიხსნება პარტნიორის კონტაქტი; დანარჩენი შეთავაზებები გადავა „არ შეირჩა“ სტატუსში.</p>
    </>}
    <ChooseOfferSheet open={!!choice} companyName={choice?.company || "კომპანია"} pending={pending} onConfirm={() => void choose()} onCancel={() => { if (!pending) setChoice(null); }}/>
  </div>;
}
