"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { ListSkeleton } from "./Skeletons";
import { MessageButton } from "./ChatPopup";
import type { Store } from "../../lib/market-client";
import { dealDate, dealError, money, type Deal, type DealContact } from "../../lib/deal-client";
import { units } from "../../lib/categories";
import styles from "./deals.module.css";

const stages = ["selected", "discuss", "terms", "progress", "complete"];
const labels = ["მომწოდებელი არჩეულია", "დეტალების განხილვა", "პირობების დადასტურება", "შესრულება", "დასრულება"];
export function DealStepper({ deal }: { deal: Deal }) {
  const current = stages.indexOf(deal.stage);
  if (current < 0) return <div className={`${styles.card} ${styles.steps}`} role="status">გარიგება გაუქმებულია · {dealDate(deal.cancelled_at)}</div>;
  const dates = [deal.selected_at, deal.discuss_at, deal.terms_at, deal.progress_at, deal.complete_at];
  return <nav className={`${styles.card} ${styles.steps}`} aria-label="გარიგების ეტაპები">
    <div className={styles.mobileSteps}><header><strong>{labels[current]}</strong><small>ეტაპი {current + 1} / 5</small></header><div className={styles.bars}>{labels.map((label, i) => <span key={label} data-done={i < current} data-current={i === current}/>)}</div>{current < 4 ? <small>შემდეგი: {labels[current + 1]}</small> : null}</div>
    <ol>{labels.map((label, i) => <li key={label} data-current={i === current} data-done={i < current} aria-current={i === current ? "step" : undefined}><span className={styles.stepNumber}>{i < current ? <Icon name="check"/> : i + 1}</span><span>{label}<small>{i < current ? dealDate(dates[i]) : i === current ? "მიმდინარე" : "მოლოდინში"}</small></span></li>)}</ol>
  </nav>;
}
export function DealShell({ deal, requestTitle, title, lead, actions, children, aside }: { deal: Deal; requestTitle: string; title: string; lead: string; actions?: ReactNode; children: ReactNode; aside: ReactNode }) {
  return <div className={styles.page}>
    <Link href="/account/?tab=requests" className={styles.back}><Icon name="chevron-left"/>ჩემი მოთხოვნები</Link>
    <header className={styles.header}><div><p className={styles.context}><Link href={`/requests/view/?id=${encodeURIComponent(deal.request_id)}`}>{requestTitle}</Link> · #{deal.id.slice(0, 8)}</p><h1>{title}</h1><p>{lead}</p></div><div className={styles.actions}>{actions}</div></header>
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
      <div className={styles.identity}><span className={styles.avatar}>{(c.company || c.name).slice(0, 2)}</span><div><h2>{c.company || c.name}</h2><p className={styles.note}>{c.id === deal.supplier_id ? "მომწოდებელი" : "მყიდველი"}</p></div></div>
      {deal.stage === "selected" ? <p className={styles.success}>კონტაქტი გაიხსნა</p> : null}
      <ul><li><Icon name="user-round"/>{c.name}</li>{c.phone ? <li><Icon name="phone"/><a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a></li> : null}{c.email ? <li><Icon name="mail"/><a href={`mailto:${c.email}`}>{c.email}</a></li> : null}</ul>
    </div>)}
    {participant ? <div className={styles.note}><MessageButton companyId={deal.supplier_id} requestId={deal.request_id}/></div> : null}
  </section>;
}
export function DealTermsRecord({ deal, compact = false, actions }: { deal: Deal; compact?: boolean; actions?: ReactNode }) {
  const unitPrice = !compact && deal.total_price != null && deal.quantity != null && deal.quantity > 0 && deal.unit
    ? `${money(deal.total_price / deal.quantity)} / ${units[deal.unit] || deal.unit}`
    : null;
  const rows = [
    ["wallet", "ჯამური ფასი", `${money(deal.total_price)}${unitPrice ? ` · ${unitPrice}` : ""}`],
    ["package", "რაოდენობა", deal.quantity == null ? "დასაზუსტებელია" : `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}`],
    ["truck", "მიწოდების ვადა", `${deal.delivery_days == null ? "დასაზუსტებელია" : `${deal.delivery_days} დღე`}${deal.delivery_date ? ` · ${dealDate(deal.delivery_date)}` : ""}`],
    ["map-pin", "ადგილი", deal.delivery_place || "დასაზუსტებელია"],
    ["receipt", "გადახდა", deal.payment_terms || "დასაზუსტებელია"],
  ];
  return <section className={styles.card}><header className={styles.cardHead}><div><h2>{compact ? "შეთანხმებული პირობები" : "MeetAny გარიგების ჩანაწერი"}</h2>{deal.terms_at ? <p className={styles.note}>პირობები · {dealDate(deal.terms_at)}</p> : null}</div>{actions}</header>
    <dl className={styles.terms}>{rows.map(([icon, label, value]) => <div key={label}><dt><Icon name={icon}/>{label}</dt><dd>{value}</dd></div>)}</dl>
    {deal.includes.length ? <ul className={styles.includes}>{deal.includes.map((item, i) => <li key={i}><Icon name="check"/>{item}</li>)}</ul> : null}
    {!compact ? <p className={styles.note}>ეს ჩანაწერი ფიქსირებს შეთანხმებას MeetAny-ზე და არ წარმოადგენს იურიდიულ ხელშეკრულებას.</p> : null}
  </section>;
}
