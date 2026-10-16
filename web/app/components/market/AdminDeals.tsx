"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import type { Store } from "../../lib/market-client";
import { dateLabel } from "../../lib/format";
import { adminMoney } from "../../lib/admin-helpers";
import { adminErrorMessage } from "../../lib/use-admin-data";
import { dealStageLabels, dealStageTone, dealStages, listAdminDeals, type AdminDealPage } from "../../lib/admin-deals";
import { AdminDealIssues } from "./AdminDealIssues";
import { AdminState } from "./AdminState";
import { ListSkeleton } from "./Skeletons";
import type { AdminAction, AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

/** Every deal: open issues first, then the list by stage and text, newest first, 25 per page. */
export function AdminDeals({ store, revision, stage, query, cursor, onChange, onClear, onOpen, onAction }: {
  store: Store; revision: number; stage: string; query: string; cursor: string;
  onChange: (key: string, value: string) => void; onClear: () => void; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void;
}) {
  const [state, setState] = useState<{ key: string; page?: AdminDealPage; error?: string }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const validStage = (dealStages as string[]).includes(stage) ? stage : "";
  const key = JSON.stringify([validStage, query, cursor, revision, retry]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      // Copied URLs may contain invalid JSON. Parse inside the promise so the
      // same recoverable error state handles it and no loading view gets stuck.
      Promise.resolve().then(() => listAdminDeals(store, { p_stage: validStage, p_query: query, p_cursor: cursor ? JSON.parse(cursor) : null }))
        .then(page => { if (active) setState({ key, page }); }, err => { if (active) setState({ key, error: err instanceof SyntaxError ? "გვერდის ბმული არასწორია. დაბრუნდით პირველ გვერდზე." : adminErrorMessage(err, "გარიგებები ვერ ჩაიტვირთა. სცადეთ ხელახლა.") }); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [store, validStage, query, cursor, key]);
  const current = state.key === key ? state : null;
  const page = current?.page;
  const filtered = !!(validStage || query);
  const total = page ? Object.values(page.stageCounts || {}).reduce((sum, n) => sum + n, 0) : 0;
  return <>
    <AdminDealIssues store={store} revision={revision} onOpen={onOpen} onAction={onAction} />
    <section className={styles.listSurface} aria-label="გარიგებები">
      <div className={styles.filters} role="search" aria-label="გარიგებების ძიება">
        <div className={styles.search}><label htmlFor="deal-search">ძიება</label><input id="deal-search" className="ma-input" type="search" value={query} maxLength={200}
          placeholder="მოთხოვნა, მხარე ან ID" onChange={event => onChange("q", event.target.value)} /></div>
        <div><label htmlFor="deal-stage">ეტაპი</label><CustomSelect id="deal-stage" className="ma-select" value={validStage} onChange={event => onChange("status", event.target.value)}>
          <option value="">ყველა ეტაპი{page && !validStage ? ` · ${total}` : ""}</option>
          {dealStages.map(s => <option key={s} value={s}>{dealStageLabels[s]}{page?.stageCounts?.[s] ? ` · ${page.stageCounts[s]}` : ""}</option>)}
        </CustomSelect></div>
      </div>
      {filtered ? <Button type="button" variant="secondary" className={styles.clear} onClick={onClear}>ფილტრების გასუფთავება</Button> : null}
      {!current ? <ListSkeleton compact kind="records" label="გარიგებები იტვირთება…" />
        : current.error ? <AdminState error title="გარიგებები ვერ ჩაიტვირთა" text={current.error} onRetry={() => setRetry(n => n + 1)} onFirst={cursor ? () => onChange("cursor", "") : undefined} />
        : !page?.items.length ? <AdminState title={filtered ? "ამ ფილტრებით გარიგება ვერ მოიძებნა" : cursor ? "ამ გვერდზე გარიგებები აღარ არის" : "გარიგებები ჯერ არ არის"}
            text={filtered ? "შეცვალეთ ძიება ან გაასუფთავეთ ფილტრები." : "მომწოდებლის არჩევის შემდეგ გარიგება აქ გამოჩნდება."} onClear={filtered ? onClear : undefined} onFirst={cursor ? () => onChange("cursor", "") : undefined} />
        : <>
          <p className={styles.count} role="status">{page.filteredTotal} გარიგება</p>
          <div className="ma-table-wrap"><table className={`ma-table ${styles.dealsTable}`}>
            <caption className="ma-sr-only">გარიგებები</caption>
            <colgroup><col className={styles.colWide} /><col /><col /><col /><col className={styles.colDate} /><col className={styles.colAction} /></colgroup>
            <thead><tr><th scope="col">გარიგება</th><th scope="col">მხარეები</th><th scope="col">ეტაპი</th><th scope="col">თანხა</th><th scope="col">განახლდა</th><th scope="col"><span className="ma-sr-only">მოქმედება</span></th></tr></thead>
            <tbody>{page.items.map(d => <tr key={d.id}>
              <td data-label="გარიგება"><button type="button" className={styles.rowLink} onClick={() => onOpen({ kind: "deal", id: d.id })}>{d.request_title}</button><small>#{d.id.slice(0, 8)}{d.request_hidden ? " · მოთხოვნა დამალულია" : ""}</small></td>
              <td data-label="მხარეები">{d.buyer_name}<small>→ {d.supplier_name}</small></td>
              <td data-label="ეტაპი"><span className={`ma-badge ma-badge--${dealStageTone(d.stage)}`}>{dealStageLabels[d.stage]}</span>{d.open_issue ? <small className={styles.warningText}>ღია პრობლემა</small> : null}</td>
              <td data-label="თანხა"><span className={styles.nowrap}>{adminMoney(d.total_price ?? d.offer_price)}</span></td>
              <td data-label="განახლდა"><time dateTime={d.updated_at} className={styles.nowrap}>{dateLabel(d.updated_at)}</time></td>
              <td data-label="მოქმედება"><Button type="button" variant="secondary" onClick={() => onOpen({ kind: "deal", id: d.id })}>დეტალების ნახვა</Button></td>
            </tr>)}</tbody>
          </table></div>
          {cursor || page.hasMore ? <nav className={styles.pagination} aria-label="გარიგებების გვერდები">
            {cursor ? <Button type="button" variant="secondary" onClick={() => onChange("cursor", "")}>პირველი გვერდი</Button> : null}
            {page.hasMore && page.nextCursor ? <Button type="button" variant="secondary" onClick={() => onChange("cursor", JSON.stringify(page.nextCursor))}>შემდეგი გვერდი</Button> : null}
          </nav> : null}
        </>}
    </section>
  </>;
}
