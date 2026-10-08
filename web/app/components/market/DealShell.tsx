"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { ListSkeleton } from "./Skeletons";
import type { Store } from "../../lib/market-client";
import { dealDate, dealError, money, type Deal, type DealContact } from "../../lib/deal-client";
import { cities, units } from "../../lib/categories";
import styles from "./deals.module.css";

const stages = ["selected", "discuss", "terms", "progress", "complete"];
const labels = ["მომწოდებელი არჩეულია", "დეტალების განხილვა", "პირობების დადასტურება", "შესრულება", "დასრულება"];
export function DealStepper({ deal }: { deal: Deal }) {
  const current = stages.indexOf(deal.stage);
  if (current < 0) return null;
  const dates = [deal.selected_at, deal.discuss_at, deal.terms_at, deal.progress_at, deal.complete_at];
  return <nav className={`${styles.card} ${styles.steps}`} aria-label="გარიგების ეტაპები">
    <div className={styles.mobileSteps}><header><strong>{deal.stage === "complete" ? "დასრულებულია" : labels[current]}</strong><small>ეტაპი {current + 1} / 5</small></header><div className={styles.bars}>{labels.map((label, i) => <span key={label} data-done={i < current} data-current={i === current}/>)}</div>{current < 4 ? <small>შემდეგი: {labels[current + 1]}</small> : null}</div>
    <ol>{labels.map((label, i) => <li key={label} data-current={i === current} data-done={i < current} aria-current={i === current ? "step" : undefined}><span className={styles.stepNumber}>{i < current ? <Icon name="check"/> : i + 1}</span><span>{i === current && deal.stage === "complete" ? "დასრულებულია" : label}<small>{i < current || (i === current && deal.stage === "complete") ? dealDate(dates[i]) : i === current ? "მიმდინარე" : "მოლოდინში"}</small></span></li>)}</ol>
  </nav>;
}
export function DealShell({ deal, requestTitle, buyer, partner, actions, children, aside }: { deal: Deal; requestTitle: string; buyer: boolean; partner: string; actions: ReactNode; children: ReactNode; aside: ReactNode }) {
  const leads: Record<string, string> = {
    selected: `${partner}-ს კონტაქტი გაიხსნა. დააზუსტეთ დეტალები ჩატში ან დაუკავშირდით პირდაპირ.`,
    discuss: "შეათანხმეთ ფასი, ვადა და პირობები. როცა ორივე მხარე შეთანხმდება, გადადით პირობების დადასტურებაზე.",
    terms: "გადაამოწმეთ საბოლოო პირობები. ორივე მხარის დადასტურების შემდეგ მომწოდებელი იწყებს შესრულებას.",
    progress: "მომწოდებელი ამზადებს შეკვეთას. განახლებები აქ გამოჩნდება.",
    complete: "მომწოდებელმა მონიშნა შეკვეთა მიწოდებულად. გადაამოწმეთ და დაადასტურეთ დასრულება.",
  };
  const title = deal.stage === "complete" ? "გარიგების დასრულება" : labels[stages.indexOf(deal.stage)] || "გარიგება გაუქმებულია";
  return <div className={styles.page}>
    <Link href={`/account/?tab=${buyer ? "requests" : "offers"}`} className={styles.back}><Icon name="chevron-left"/>{buyer ? "ჩემი მოთხოვნები" : "ჩემი შეთავაზებები"}</Link>
    <header className={styles.header}><div><p className={styles.context}>{requestTitle} · #{deal.id.slice(0, 8).toUpperCase()}</p><h1>{title}</h1><p>{leads[deal.stage]}</p></div><div className={styles.actions}>{actions}</div></header>
    <DealStepper deal={deal}/><div className={styles.grid}><div className={styles.main}>{children}</div><aside className={styles.aside}>{aside}</aside></div>
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
    {!result ? <ListSkeleton compact label="კონტაქტი იტვირთება…" /> : result.error ? <><p role="alert">{result.error}</p><Button variant="secondary" onClick={() => setRetry(v => v + 1)}>ხელახლა ცდა</Button></> : result.contacts?.map(c => <div key={c.id}>
      <div className={styles.identity}><span className={styles.avatar}>{(c.company || c.name).slice(0, 2)}</span><div><h2>{c.company || c.name}{store.getCompany(c.id)?.verified ? <Icon name="badge-check"/> : null}</h2><p className={styles.note}>{c.id === deal.supplier_id ? "მომწოდებელი" : "მყიდველი"}{store.getCompany(c.id)?.city ? ` · ${cities[store.getCompany(c.id).city] || store.getCompany(c.id).city}` : ""}</p></div></div>
      <p className={styles.success}><Icon name="lock-keyhole"/>კონტაქტი გაიხსნა</p>
      <ul><li><Icon name="user-round"/>{c.name}{c.contact_position ? <small>{c.contact_position}</small> : null}</li>{c.phone ? <li><Icon name="phone"/><a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a></li> : null}{c.email ? <li><Icon name="mail"/><a href={`mailto:${c.email}`}>{c.email}</a></li> : null}</ul>
    </div>)}

  </section>;
}
export function DealTermsRecord({ deal, request, compact = false, actions }: { deal: Deal; request?: { quantity?: number | null; unit?: string | null; neededBy?: string | null }; compact?: boolean; actions?: ReactNode }) {
  const unitPrice = deal.total_price != null && deal.quantity != null && deal.quantity > 0 && deal.unit
    ? `${money(deal.total_price / deal.quantity)} / ${units[deal.unit] || deal.unit}`
    : null;
  const rows = [
    ["wallet", "ჯამური ფასი", `${money(deal.total_price)}${unitPrice ? ` · ${unitPrice}` : ""}`],
    ["package", "რაოდენობა", deal.quantity == null ? "დასაზუსტებელია" : `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}`],
    ["truck", "მიწოდების ვადა", `${deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}${deal.delivery_date ? ` · ${dealDate(deal.delivery_date)}` : ""}`],
    ["map-pin", "ადგილი", deal.delivery_place || "დასაზუსტებელია"],
    ["receipt", "გადახდა", deal.payment_terms || "დასაზუსტებელია"],
  ];
  const previous: Record<string, string | undefined> = {
    "რაოდენობა": request?.quantity != null && (request.quantity !== deal.quantity || request.unit !== deal.unit) ? `${request.quantity} ${units[request.unit || ""] || request.unit || ""}` : undefined,
    "მიწოდების ვადა": request?.neededBy && deal.delivery_date && request.neededBy !== deal.delivery_date ? dealDate(request.neededBy) : undefined,
  };
  return <section className={styles.card}><header className={styles.cardHead}><div><h2>{compact ? "შეთანხმებული პირობები" : "MeetAny გარიგების ჩანაწერი"}</h2>{!compact ? <p className={styles.recordDate}>შეთანხმდა ჩატში · {dealDate(deal.terms_at)}</p> : null}</div>{compact ? <span className={styles.recordDate}>{dealDate(deal.terms_at)}</span> : actions}</header>
    <dl className={styles.terms}>{rows.map(([icon, label, value]) => <div key={label}><dt><Icon name={icon}/>{label}</dt><dd>{value}{previous[label] ? <small className={styles.previous}>მოთხოვნაში იყო: {previous[label]}</small> : null}</dd></div>)}{!compact && deal.includes.length ? <div><dt><Icon name="check"/>მოიცავს</dt><dd><ul className={styles.termIncludes}>{deal.includes.map((item, i) => <li key={i}><Icon name="check"/>{item}</li>)}</ul></dd></div> : null}</dl>
    {compact && deal.includes.length ? <ul className={styles.includes}>{deal.includes.map((item, i) => <li key={i}><Icon name="check"/>{item}</li>)}</ul> : null}
    {!compact ? <p className={styles.note}><Icon name="info"/> ეს ჩანაწერი ფიქსირებს შეთანხმებას MeetAny-ზე და არ წარმოადგენს იურიდიულ ხელშეკრულებას.</p> : null}
  </section>;
}
