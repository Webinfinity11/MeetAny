"use client";
import { AdminIssueComment } from "./AdminIssueComment";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import type { Store } from "../../lib/market-client";
import { units } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { adminDateTime, adminMoney } from "../../lib/admin-helpers";
import { dealActionLabel, type Deal } from "../../lib/deal-client";
import { dealStageLabels, dealStageTone, forcedStages, issueOutcomes, issueReasons, listAdminDeals, type AdminDealRow } from "../../lib/admin-deals";
import { FileAttachments } from "./FileAttachments";
import type { AdminAction, AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

type Issue = NonNullable<Deal["issues"]>[number] & { outcome?: string | null; resolved_at?: string | null };
const criteria = ["ხარისხი", "ვადების დაცვა", "კომუნიკაცია", "საიმედოობა"];

/** Read-only view of one deal for the admin, with the two admin actions: change the stage or cancel (with a reason). */
export function AdminDealDetail({ store, id, revision, onClose, onOpen, onAction }: {
  store: Store; id: string; revision: number; onClose: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void;
}) {
  const [state, setState] = useState<{ key: string; deal?: Deal; row?: AdminDealRow | null; error?: boolean }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const key = `${id}:${revision}:${retry}`;
  useEffect(() => {
    let active = true;
    Promise.all([store.callRpc("get_deal", { p_deal_id: id }) as Promise<Deal>, listAdminDeals(store, { p_query: id, p_limit: 1 })])
      .then(([deal, page]) => { if (active) setState({ key, deal, row: page.items.find(d => d.id === id) || null }); }, () => { if (active) setState({ key, error: true }); });
    return () => { active = false; };
  }, [store, id, key]);
  const current = state.key === key ? state : null;
  const deal = current?.deal, row = current?.row;
  const party = (who: string) => who === deal?.buyer_id ? `მყიდველი · ${row?.buyer_name || ""}` : who === deal?.supplier_id ? `მომწოდებელი · ${row?.supplier_name || ""}` : "ადმინისტრატორი";
  let body: React.ReactNode;
  if (!current) body = <p className={styles.note} role="status">გარიგება იტვირთება…</p>;
  else if (current.error || !deal) body = <div role="alert"><p className={styles.note}>გარიგება ვერ ჩაიტვირთა.</p><Button variant="secondary" onClick={() => setRetry(n => n + 1)}>ხელახლა ცდა</Button></div>;
  else {
    const issues = (deal.issues || []) as Issue[];
    const terms: [string, React.ReactNode][] = [
      ["ჯამი", adminMoney(deal.total_price ?? row?.offer_price ?? null)],
      ...(deal.quantity != null ? [["რაოდენობა", `${deal.quantity} ${units[deal.unit || ""] || deal.unit || ""}`] as [string, React.ReactNode]] : []),
      ...(deal.delivery_days != null || deal.delivery_date ? [["მიწოდება", [deal.delivery_days != null ? `${deal.delivery_days} დღეში` : "", deal.delivery_date ? dateLabel(deal.delivery_date) : ""].filter(Boolean).join(" · ")] as [string, React.ReactNode]] : []),
      ...(deal.delivery_place ? [["ადგილი", deal.delivery_place] as [string, React.ReactNode]] : []),
      ...(deal.payment_terms ? [["გადახდა", deal.payment_terms] as [string, React.ReactNode]] : []),
      ...(deal.includes?.length ? [["შედის", deal.includes.join(", ")] as [string, React.ReactNode]] : []),
      ["დადასტურება", [deal.buyer_confirmed_at ? "მყიდველმა" : "", deal.supplier_confirmed_at ? "მომწოდებელმა" : ""].filter(Boolean).join(" და ") || "ჯერ არავის"],
    ];
    body = <div className={styles.detail}>
      <div className={styles.detailHead}>
        <h3>{row?.request_title || "გარიგება"}</h3>
        <p>დაიწყო {dateLabel(deal.selected_at)}</p>
        <div className={styles.detailBadges}><span className={`ma-badge ma-badge--${dealStageTone(deal.stage)}`}>{dealStageLabels[deal.stage]}</span>{issues.some(i => i.status === "open") ? <span className="ma-badge ma-badge--warning">ღია პრობლემა</span> : null}</div>
      </div>
      <dl className={styles.detailFacts}>
        <dt>მოთხოვნა</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "request", id: deal.request_id })}>{row?.request_title || "მოთხოვნის ნახვა"}</button></dd>
        <dt>მყიდველი</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: deal.buyer_id })}>{row?.buyer_name || "მყიდველი"}</button></dd>
        <dt>მომწოდებელი</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: deal.supplier_id })}>{row?.supplier_name || "მომწოდებელი"}</button></dd>
        <dt>შეთავაზება</dt><dd><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "offer", id: deal.offer_id })}>შეთავაზების ნახვა</button></dd>
      </dl>
      <section className={styles.detailList} aria-label="პირობები"><h4>პირობები</h4>
        <dl className={styles.detailFacts}>{terms.map(([dt, dd]) => <div key={dt} className={styles.factRow}><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
      </section>
      {issues.length ? <section className={styles.detailList}><h4>პრობლემები <span>{issues.length}</span></h4><ul>{issues.map(issue => <li key={issue.id}>
        <strong className={styles.listTitle}>{issueReasons[issue.reason] || issue.reason} · {issue.status === "open" ? "განხილვაშია" : issueOutcomes[issue.outcome || "resolved"]}</strong>
        <small>{party(issue.actor_id)} · {adminDateTime(issue.created_at)}</small>
        <p className={styles.listText}>{issue.body}</p>
        {issue.resolution ? <p className={styles.listText}>შედეგი: {issue.resolution}</p> : null}
        <AdminIssueComment store={store} issueId={issue.id} onSaved={() => setRetry(n => n + 1)}/>
        {issue.status === "open" ? <Button variant="secondary" size="sm" onClick={() => onAction({ kind: "issues", action: "resolveIssue", id: issue.id, label: `${row?.request_title || "გარიგება"} · ${issueReasons[issue.reason] || ""}`,
          choice: { label: "შედეგი", options: Object.entries(issueOutcomes).filter(([value]) => value !== "cancelled" || deal.stage !== "complete") } })}>განხილვის დასრულება…</Button> : null}
      </li>)}</ul><FileAttachments store={store} kind="issue" target={deal.id} label="პრობლემის ფაილები" /></section> : null}
      {deal.updates?.filter(u => u.status === "admin_comment").map(u => <section key={u.id}><h4>ადმინისტრაციის კომენტარი</h4><p className={styles.detailText}>{u.body}</p></section>)}
      {deal.rating != null ? <section className={styles.detailList}><h4>შეფასება <span>{deal.rating}/5</span></h4>
        {deal.review_details?.scores?.length ? <p className={styles.note}>{deal.review_details.scores.map((score, i) => `${criteria[i] || ""} ${score}`).join(" · ")}{deal.review_details.would_again ? " · კვლავ ითანამშრომლებს" : ""}</p> : null}
        {deal.review ? <p className={styles.detailText}>{deal.review}</p> : null}
      </section> : null}
      {deal.events?.length ? <section className={styles.detailList}><h4>ისტორია <span>{deal.events.length}</span></h4><ol className={styles.timeline}>
        {[...deal.events].reverse().map(event => <li key={event.id}><span>{dealActionLabel(event.action)}</span><small>{party(event.actor_id)} · {adminDateTime(event.created_at)}</small></li>)}
      </ol></section> : null}
    </div>;
  }
  const stages = deal ? forcedStages(deal) : [];
  const label = `${row?.request_title || "გარიგება"} · ${row?.buyer_name || ""} → ${row?.supplier_name || ""}`;
  const footer = deal && stages.length ? <div className={styles.detailActions}>
    <Button type="button" variant="secondary" onClick={() => onAction({ kind: "deals", action: "dealStage", id: deal.id, label,
      choice: { label: "ახალი ეტაპი", options: stages.filter(s => s !== "cancelled").map(s => [s, dealStageLabels[s]]) } })}>ეტაპის შეცვლა…</Button>
    <Button type="button" variant="danger-quiet" onClick={() => onAction({ kind: "deals", action: "dealCancel", id: deal.id, label })}>გარიგების გაუქმება…</Button>
  </div> : null;
  return <Sheet open onClose={onClose} title="გარიგება" footer={footer} className={styles.drawer}>{body}</Sheet>;
}
