"use client";
import { Button } from "../ui/Button";


import { useCallback, useState } from "react";
import Link from "next/link";
import type { Store } from "../../lib/market-client";
import { useBusinessResource } from "../../lib/business-client";
import { dateLabel } from "../../lib/format";
import { CustomSelect } from "../ui/CustomSelect";
import { AdminState } from "./AdminState";
import { ListSkeleton } from "./Skeletons";
import styles from "./admin.module.css";

export type AdminReport = {
  id: string; target_kind: "request" | "company" | "offer"; target_id: string; context_id: string | null;
  reason: "spam" | "fake" | "offensive" | "other"; body: string; status: "new" | "handled";
  resolution: "hidden" | "rejected" | null; resolution_reason: string | null; created_at: string; handled_at: string | null;
  reporter_id: string; reporter_name: string | null; reporter_email: string | null;
  target_label: string | null; target_exists: boolean; target_removed: boolean; context_label: string; offer_status: string;
  target_reports: number; target_new: number; handler_name: string | null;
};
type Page = { items: AdminReport[]; total: number; newCount: number };
export type ReportAction = { report: AdminReport; action: "reportHide" | "reportReject"; label: string };

export const reportReasons: Record<string, string> = { spam: "სპამი ან რეკლამა", fake: "ყალბი ან შეცდომაში შემყვანი", offensive: "შეურაცხმყოფელი", other: "სხვა" };
const kinds: Record<string, string> = { request: "მოთხოვნა", company: "კომპანია", offer: "შეთავაზება" };
/** Hiding means the existing moderation action for that kind of content. */
export const hideLabels: Record<string, string> = { request: "დამალვა", company: "დაბლოკვა", offer: "წაშლა" };
const PAGE = 20;

export const reportTargetLabel = (r: AdminReport) =>
  r.target_kind === "offer" ? `${r.target_label || "კომპანია"}${r.context_label ? ` · ${r.context_label}` : ""}` : r.target_label || `${kinds[r.target_kind]} · #${r.target_id.slice(0, 8)}`;
const targetHref = (r: AdminReport) => r.target_kind === "company" ? `/companies/view/?id=${r.target_id}`
  : `/requests/view/?id=${r.target_kind === "offer" ? r.context_id : r.target_id}`;

/** Reports queue: new or handled, newest first, 20 per page. */
export function AdminReports({ store, status, revision, onStatus, onAction, onCount }: {
  store: Store; status: "new" | "handled"; revision: number;
  onStatus: (status: string) => void; onAction: (action: ReportAction) => void; onCount: (count: number) => void;
}) {
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => store.adminListReports(status, offset).then((page: Page) => { onCount(Number(page.newCount) || 0); return page; }), [store, status, offset, onCount]);
  const resource = useBusinessResource<Page>(load, `${status}:${offset}:${revision}`);
  const page = resource.data;
  return <>
    <div className={styles.filters}>
      <div><label htmlFor="admin-report-status">სტატუსი</label><CustomSelect id="admin-report-status" className="ma-select" value={status} onChange={event => { setOffset(0); onStatus(event.target.value); }}>
        <option value="new">ახალი</option><option value="handled">დამუშავებული</option>
      </CustomSelect></div>
    </div>
    {resource.error ? <AdminState error title="საჩივრები ვერ ჩაიტვირთა" text={resource.error} onRetry={resource.reload} />
      : !page ? <ListSkeleton compact kind="records" label="საჩივრები იტვირთება…" />
      : !page.items.length ? <AdminState title={status === "new" ? "ახალი საჩივრები არ არის" : "დამუშავებული საჩივრები ჯერ არ არის"} text={status === "new" ? "მომხმარებლების შეტყობინებები აქ გამოჩნდება." : undefined} onFirst={offset ? () => setOffset(0) : undefined} />
      : <>
        <p className={styles.count} role="status">{page.total} საჩივარი</p>
        <div className="ma-table-wrap"><table className="ma-table">
          <caption className="ma-sr-only">საჩივრები</caption>
          <thead><tr>{["საჩივარი", "მიზეზი", "ავტორი", "თარიღი", status === "new" ? "მოქმედება" : "შედეგი"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{page.items.map(r => <tr key={r.id}>
            <td data-label="საჩივარი">
              {r.target_exists ? <Link className="ma-link" href={targetHref(r)} target="_blank">{reportTargetLabel(r)}</Link> : reportTargetLabel(r)}
              <small>{kinds[r.target_kind]}{!r.target_exists ? " · წაშლილია" : r.target_removed ? (r.target_kind === "company" ? " · დაბლოკილია" : " · დამალულია") : ""} · სულ {r.target_reports} საჩივარი{r.target_new > 1 && r.status === "new" ? `, ${r.target_new} ახალი` : ""}</small>
            </td>
            <td data-label="მიზეზი"><span className={`ma-badge ma-badge--${r.reason === "other" ? "neutral" : "warning"}`}>{reportReasons[r.reason]}</span>{r.body ? <p className={styles.excerpt}>{r.body}</p> : null}</td>
            <td data-label="ავტორი">{r.reporter_name || `მომხმარებელი · #${r.reporter_id.slice(0, 8)}`}{r.reporter_email ? <small>{r.reporter_email}</small> : null}</td>
            <td data-label="თარიღი"><time dateTime={r.created_at}>{dateLabel(r.created_at)}</time></td>
            {r.status === "new" ? <td data-label="მოქმედება"><div className="ma-proto-tableactions">
              <Button type="button" variant="danger-quiet" disabled={r.target_kind === "offer" && r.offer_status === "chosen"}
                aria-describedby={r.target_kind === "offer" && r.offer_status === "chosen" ? `report-locked-${r.id}` : undefined}
                onClick={() => onAction({ report: r, action: "reportHide", label: reportTargetLabel(r) })}>{hideLabels[r.target_kind]}</Button>
              <Button type="button" variant="secondary" onClick={() => onAction({ report: r, action: "reportReject", label: reportTargetLabel(r) })}>უარყოფა</Button>
            </div>{r.target_kind === "offer" && r.offer_status === "chosen" ? <small id={`report-locked-${r.id}`}>არჩეული შეთავაზება არ იშლება.</small> : null}</td>
              : <td data-label="შედეგი"><span className={`ma-badge ma-badge--${r.resolution === "hidden" ? "success" : "neutral"}`}>{r.resolution === "hidden" ? "ზომა მიღებულია" : "უარყოფილია"}</span>
                {r.resolution_reason ? <small>მიზეზი: {r.resolution_reason}</small> : null}
                <small>{[r.handler_name, r.handled_at ? dateLabel(r.handled_at) : ""].filter(Boolean).join(" · ")}</small></td>}
          </tr>)}</tbody>
        </table></div>
        {page.total > PAGE ? <nav className={styles.pagination} aria-label="საჩივრების გვერდები">
          <Button type="button" variant="secondary" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - PAGE))}>წინა</Button>
          <Button type="button" variant="secondary" disabled={offset + PAGE >= page.total} onClick={() => setOffset(n => n + PAGE)}>შემდეგი</Button>
        </nav> : null}
      </>}
  </>;
}
