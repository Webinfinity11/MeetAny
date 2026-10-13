"use client";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { CustomSelect } from "../ui/CustomSelect";
import type { Store } from "../../lib/market-client";
import { dateLabel } from "../../lib/format";
import { adminErrorMessage } from "../../lib/use-admin-data";
import { AdminState } from "./AdminState";
import { ListSkeleton } from "./Skeletons";
import type { AdminAction, AdminTarget } from "./AdminDetail";
import styles from "./admin.module.css";

type Review = {
  id: string; request_id: string; company_id: string; author_id: string; rating: number; body: string; status: "pending" | "published" | "hidden";
  reason: string; updated_at: string; company: string; author: string; request_title: string | null; deal_id: string | null;
  source: "deal" | "manual"; scores: number[] | null; would_again: boolean | null;
};
type Page = { total: number; items: Review[] };
const statuses: Record<string, [string, string]> = { pending: ["მოლოდინში", "warning"], published: ["გამოქვეყნებული", "success"], hidden: ["დამალული", "neutral"] };
const sources: Record<string, string> = { deal: "გარიგება", manual: "ხელით დაწერილი" };
const criteria = ["ხარისხი", "ვადები", "კომუნიკაცია", "საიმედოობა"];
const PAGE = 20;

/** Reviews as one list: who reviewed whom, stars, date, source and status; hiding needs a reason. */
export function AdminReviews({ store, revision, onOpen, onAction }: { store: Store; revision: number; onOpen: (target: AdminTarget) => void; onAction: (action: AdminAction) => void }) {
  const [status, setStatus] = useState(""), [source, setSource] = useState(""), [query, setQuery] = useState(""), [offset, setOffset] = useState(0);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; page?: Page; error?: string }>({ key: "" });
  const key = JSON.stringify([status, source, query, offset, revision, retry]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      store.callRpc("admin_list_reviews", { p_status: status || null, p_source: source || null, p_q: query.trim() || null, p_offset: offset })
        .then((page: Page) => { if (active) setState({ key, page }); }, (err: unknown) => { if (active) setState({ key, error: adminErrorMessage(err, "შეფასებები ვერ ჩაიტვირთა. სცადეთ ხელახლა.") }); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [store, status, source, query, offset, key]);
  const current = state.key === key ? state : null;
  const page = current?.page;
  const filtered = !!(status || source || query);
  const set = (fn: (v: string) => void) => (value: string) => { fn(value); setOffset(0); };
  const clear = () => { setStatus(""); setSource(""); setQuery(""); setOffset(0); };
  return <section className={styles.listSurface} aria-label="შეფასებები">
    <div className={styles.filters} role="search" aria-label="შეფასებების ძიება">
      <div className={styles.search}><label htmlFor="review-search">ძიება</label><input id="review-search" className="ma-input" type="search" value={query} maxLength={200} placeholder="კომპანია, ავტორი ან ტექსტი" onChange={e => set(setQuery)(e.target.value)} /></div>
      <div><label htmlFor="review-status">სტატუსი</label><CustomSelect id="review-status" className="ma-select" value={status} onChange={e => set(setStatus)(e.target.value)}>
        <option value="">ყველა სტატუსი</option>{Object.entries(statuses).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}</CustomSelect></div>
      <div><label htmlFor="review-source">წყარო</label><CustomSelect id="review-source" className="ma-select" value={source} onChange={e => set(setSource)(e.target.value)}>
        <option value="">ყველა წყარო</option>{Object.entries(sources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</CustomSelect></div>
    </div>
    {filtered ? <Button type="button" variant="secondary" className={styles.clear} onClick={clear}>ფილტრების გასუფთავება</Button> : null}
    {!current ? <ListSkeleton compact kind="records" label="შეფასებები იტვირთება…" />
      : current.error ? <AdminState error title="შეფასებები ვერ ჩაიტვირთა" text={current.error} onRetry={() => setRetry(n => n + 1)} />
      : !page?.items.length ? <AdminState title={filtered ? "ამ ფილტრებით შეფასება ვერ მოიძებნა" : "შეფასებები ჯერ არ არის"} text={filtered ? "შეცვალეთ ძიება ან გაასუფთავეთ ფილტრები." : "დასრულებული გარიგების შეფასება აქ გამოჩნდება."} onClear={filtered ? clear : undefined} />
      : <>
        <p className={styles.count} role="status">{page.total} შეფასება</p>
        <div className="ma-table-wrap"><table className={`ma-table ${styles.reviewsTable}`}>
          <caption className="ma-sr-only">შეფასებები</caption>
          <colgroup><col className={styles.colWide} /><col /><col /><col className={styles.colDate} /><col /><col /><col className={styles.colAction} /></colgroup>
          <thead><tr>{["შეფასება", "ავტორი", "ქულა", "თარიღი", "წყარო", "სტატუსი"].map(label => <th scope="col" key={label}>{label}</th>)}<th scope="col"><span className="ma-sr-only">მოქმედება</span></th></tr></thead>
          <tbody>{page.items.map(r => <tr key={r.id}>
            <td data-label="შეფასება"><button type="button" className={styles.rowLink} onClick={() => onOpen({ kind: "user", id: r.company_id })}>{r.company}</button>
              {r.body ? <><p id={`review-body-${r.id}`} className={expanded.includes(r.id)?styles.reviewBody:styles.excerpt}>{r.body}</p><Button type="button" variant="ghost" aria-expanded={expanded.includes(r.id)} aria-controls={`review-body-${r.id}`} onClick={()=>setExpanded(ids=>ids.includes(r.id)?ids.filter(id=>id!==r.id):[...ids,r.id])}>{expanded.includes(r.id)?"შეკეცვა":"სრულად"}</Button></> : null}
              {r.scores?.length ? <small>{r.scores.map((s, i) => `${criteria[i]} ${s}`).join(" · ")}{r.would_again ? " · კვლავ ითანამშრომლებს" : ""}</small> : null}
              {r.status === "hidden" && r.reason ? <small>დამალვის მიზეზი: {r.reason}</small> : null}</td>
            <td data-label="ავტორი"><button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "user", id: r.author_id })}>{r.author}</button></td>
            <td data-label="ქულა"><span className={styles.stars} aria-label={`${r.rating} / 5`}>★ {r.rating}</span></td>
            <td data-label="თარიღი"><time dateTime={r.updated_at} className={styles.nowrap}>{dateLabel(r.updated_at)}</time></td>
            <td data-label="წყარო">{r.deal_id ? <button type="button" className={styles.detailLink} onClick={() => onOpen({ kind: "deal", id: r.deal_id! })}>{sources.deal}</button> : sources[r.source]}</td>
            <td data-label="სტატუსი"><span className={`ma-badge ma-badge--${statuses[r.status][1]}`}>{statuses[r.status][0]}</span></td>
            <td data-label="მოქმედება">{r.status === "hidden"
              ? <Button type="button" variant="secondary" onClick={() => onAction({ kind: "reviews", action: "publishReview", id: r.id, label: `${r.company} · ${r.author}`, reviewBody: r.body })}>აღდგენა…</Button>
              : <Button type="button" variant="danger-quiet" onClick={() => onAction({ kind: "reviews", action: "hideReview", id: r.id, label: `${r.company} · ${r.author}`, reviewBody: r.body })}>დამალვა…</Button>}</td>
          </tr>)}</tbody>
        </table></div>
        {page.total > PAGE ? <nav className={styles.pagination} aria-label="შეფასებების გვერდები">
          <Button type="button" variant="secondary" disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - PAGE))}>წინა</Button>
          <Button type="button" variant="secondary" disabled={offset + PAGE >= page.total} onClick={() => setOffset(n => n + PAGE)}>შემდეგი</Button>
        </nav> : null}
      </>}
  </section>;
}
