"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { ListSkeleton } from "./Skeletons";
import { CompanyAvatar } from "./CompanyAvatar";
import { FileAttachments } from "./FileAttachments";
import type { Store } from "../../lib/market-client";
import { dealDate, dealError, dealStageLabel, money, type Deal, type DealContact, type DealStage } from "../../lib/deal-client";
import { cities, units } from "../../lib/categories";
import styles from "./deals.module.css";

const stages: DealStage[] = ["selected", "discuss", "terms", "progress", "complete"];
export function DealStepper({ deal }: { deal: Deal }) {
  const current = stages.indexOf(deal.stage);
  if (current < 0) return null;
  const done = (i: number) => i < current || deal.stage === "complete";
  const dates = [deal.selected_at, deal.discuss_at, deal.terms_at, deal.progress_at, deal.complete_at];
  return <nav className={`${styles.card} ${styles.steps}`} aria-label="გარიგების ეტაპები">
    <div className={styles.mobileSteps}><header><strong>{dealStageLabel(deal.stage)}</strong><small>ეტაპი {current + 1} / 5</small></header><div className={styles.bars}>{stages.map((stage, i) => <span key={stage} data-done={done(i)} data-current={i === current && !done(i)}/>)}</div>{current < 4 ? <small>შემდეგი: {dealStageLabel(stages[current + 1])}</small> : null}</div>
    <ol>{stages.map((stage, i) => <li key={stage} data-current={i === current && !done(i)} data-done={done(i)} aria-current={i === current ? "step" : undefined}><span className={styles.stepNumber}>{done(i) ? <Icon name="check"/> : i + 1}</span><span>{dealStageLabel(stage)}<small>{done(i) ? dealDate(dates[i]) : i === current ? "მიმდინარე" : "მოლოდინში"}</small></span></li>)}</ol>
  </nav>;
}
export function DealShell({ deal, requestTitle, partner, actions, summary, children, aside, waiting }: { deal: Deal; requestTitle: string; partner: string; actions: ReactNode; summary?: ReactNode; children: ReactNode; aside: ReactNode; waiting?: string }) {
  const leads: Record<string, string> = {
    selected: `პარტნიორის კონტაქტი გაიხსნა: ${partner}. დააზუსტეთ დეტალები ჩატში ან დაუკავშირდით პირდაპირ.`,
    discuss: "შეათანხმეთ ფასი, ვადა და პირობები. როცა ორივე მხარე შეთანხმდება, გადადით პირობების დადასტურებაზე.",
    terms: "გადაამოწმეთ საბოლოო პირობები. ორივე მხარის დადასტურების შემდეგ მომწოდებელი იწყებს შესრულებას.",
    progress: "მომწოდებელი ამზადებს შეკვეთას. განახლებები აქ გამოჩნდება.",
    complete: "მყიდველმა დაადასტურა შეკვეთის მიღება. აქ ინახება შეთანხმებული პირობები და თანამშრომლობის შეფასება.",
    cancelled: "გარიგება აღარ გრძელდება. ჩანაწერი ისტორიისთვის ინახება.",
  };
  return <div className={styles.page}>
    <Link href="/account/?tab=deals" className={styles.back}><Icon name="chevron-left"/>გარიგებები</Link>
    <header className={styles.header}><div><h1>{dealStageLabel(deal.stage)}</h1><p className={styles.context}>{requestTitle} · #{deal.id.slice(0, 8).toUpperCase()}</p><p>{waiting || leads[deal.stage]}</p></div>{actions ? <div className={styles.actions}>{actions}</div> : null}</header>
    <DealStepper deal={deal}/>{summary}<div className={styles.grid}><div className={styles.main}>{children}</div><aside className={styles.aside}>{aside}</aside></div>
  </div>;
}
export function DealContactCard({ store, deal, participant }: { store: Store; deal: Deal; participant: boolean }) {
  const call = store.callRpc;
  const [result, setResult] = useState<{ contacts?: DealContact[]; error?: string }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void call("get_deal_contact", { p_deal_id: deal.id }).then((contacts: DealContact[]) => { if (active) setResult({ contacts }); }, (error: unknown) => { if (active) setResult({ error: dealError(error) }); });
    return () => { active = false; };
  }, [call, deal.id, deal.revision, retry]);
  if (deal.stage === "cancelled" && participant) return <section className={styles.card}><h2>კონტაქტი მიუწვდომელია</h2><p className={styles.note}>გაუქმებული გარიგების კონტაქტი აღარ იხსნება.</p></section>;
  return <section className={`${styles.card} ${styles.contact}`} aria-label="გარიგების კონტაქტი">
    {!result ? <ListSkeleton compact label="კონტაქტი იტვირთება…" /> : result.error ? <><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => setRetry(v => v + 1)}>ხელახლა ცდა</Button></> : result.contacts?.map(c => {
      const company = store.getCompany(c.id);
      return <div key={c.id}>
        <div className={styles.identity}><CompanyAvatar name={c.company || c.name} logoUrl={company?.logoUrl}/><div><h2>{c.company || c.name}{company?.verified ? <Icon name="badge-check"/> : null}</h2><p className={styles.note}>{c.id === deal.supplier_id ? "მომწოდებელი" : "მყიდველი"}{company?.city ? ` · ${cities[company.city] || company.city}` : ""}</p></div></div>
        <ul>{c.name && c.name.trim() !== c.company?.trim() ? <li><Icon name="user-round"/><span>{c.name}{c.contact_position ? <small>{c.contact_position}</small> : null}</span></li> : null}{c.phone ? <li><Icon name="phone"/><a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a></li> : null}{c.email ? <li><Icon name="mail"/><a href={`mailto:${c.email}`}>{c.email}</a></li> : null}</ul>
      </div>;
    })}
  </section>;
}
type RecordRequest = { quantity?: number | null; unit?: string | null; neededBy?: string | null };
function termRows(deal: Deal) {
  const unitPrice = deal.total_price != null && deal.quantity != null && deal.quantity > 0 && deal.unit ? `${money(deal.total_price / deal.quantity)} / ${units[deal.unit] || deal.unit}` : null;
  return [
    ["wallet", "ჯამური ფასი", `${money(deal.total_price)}${unitPrice ? ` · ${unitPrice}` : ""}`],
    ["package", "რაოდენობა", deal.quantity == null ? "დასაზუსტებელია" : `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}`],
    ["truck", "შესრულების ვადა", `${deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}${deal.delivery_date ? ` · ${dealDate(deal.delivery_date)}` : ""}`],
    ["map-pin", "ადგილი", deal.delivery_place || "დასაზუსტებელია"],
    ["receipt", "გადახდა", deal.payment_terms || "დასაზუსტებელია"],
  ];
}
/** The terms as one record. "full" is the terms stage; "compact" sits beside or above the work once terms are fixed. */
export function DealTermsRecord({ store, deal, request, compact = false, actions }: { store?: Store; deal: Deal; request?: RecordRequest; compact?: boolean; actions?: ReactNode }) {
  const previous: Record<string, string | undefined> = {
    "რაოდენობა": request?.quantity != null && (request.quantity !== deal.quantity || request.unit !== deal.unit) ? `${request.quantity} ${units[request.unit || ""] || request.unit || ""}` : undefined,
    "შესრულების ვადა": request?.neededBy && deal.delivery_date && request.neededBy !== deal.delivery_date ? dealDate(request.neededBy) : undefined,
  };
  const agreed = !!(deal.buyer_confirmed_at && deal.supplier_confirmed_at);
  const agreedAt = [deal.buyer_confirmed_at, deal.supplier_confirmed_at].sort().at(-1);
  const list = <dl className={styles.terms}>{termRows(deal).map(([icon, label, value]) => <div key={label}><dt><Icon name={icon}/>{label}</dt><dd>{value}{!compact && previous[label] ? <small className={styles.previous}>მოთხოვნაში იყო: {previous[label]}</small> : null}</dd></div>)}{deal.includes.length ? <div><dt><Icon name="check"/>მოიცავს</dt><dd><ul className={styles.termIncludes}>{deal.includes.map((item, i) => <li key={i}><Icon name="check"/>{item}</li>)}</ul></dd></div> : null}</dl>;
  const files = store ? <FileAttachments store={store} kind="offer" target={deal.offer_id} label="შეთავაზების ფაილები"/> : null;
  if (compact) return <section className={`${styles.card} ${styles.record}`}><header className={styles.cardHead}><h2>შეთანხმებული პირობები</h2>{agreedAt ? <span className={styles.recordDate}>{dealDate(agreedAt)}</span> : null}</header>{list}{files}</section>;
  return <section className={`${styles.card} ${styles.record}`}><header className={styles.cardHead}><div><h2>MeetAny გარიგების ჩანაწერი</h2><p className={styles.recordDate}>{agreed ? `შეთანხმდა · ${dealDate(agreedAt)}` : "ელოდება ორივე მხარის დადასტურებას"}</p></div>{actions}</header>
    {list}{files}
    <p className={styles.note}><Icon name="info"/> ეს ჩანაწერი ფიქსირებს შეთანხმებას MeetAny-ზე და არ წარმოადგენს იურიდიულ ხელშეკრულებას.</p>
  </section>;
}
/** On narrow screens the agreed terms sit right under the stepper, folded, so they never end up below the work. */
export function DealTermsFold({ store, deal }: { store: Store; deal: Deal }) {
  return <details className={`${styles.card} ${styles.termsFold}`}><summary><span><Icon name="file-text"/>შეთანხმებული პირობები</span><strong>{money(deal.total_price)}</strong></summary>
    <dl className={styles.terms}>{termRows(deal).map(([icon, label, value]) => <div key={label}><dt><Icon name={icon}/>{label}</dt><dd>{value}</dd></div>)}</dl>
    {deal.includes.length ? <ul className={styles.termIncludes}>{deal.includes.map((item, i) => <li key={i}><Icon name="check"/>{item}</li>)}</ul> : null}
    <FileAttachments store={store} kind="offer" target={deal.offer_id} label="შეთავაზების ფაილები"/>
  </details>;
}
