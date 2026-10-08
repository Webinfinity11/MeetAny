"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import type { Store } from "../../../lib/market-client";
import { useDeal, dealHref, dealDate, dealActionLabel } from "../../../lib/deal-client";
import { Status } from "./shared";
import styles from "./account.module.css";
type Notice = { deal_action?: string | null; deal_id?: string | null; request_id: string; title?: string; created_at: string };
type Cursor = { created_at: string; id: string } | null;
/** Read the whole notification history: a deal may exist only on an older page. */
export function useAccountDeals(store: Store, actor: string) {
  const [result, setResult] = useState<{ actor: string; items: Notice[]; error?: string }>();
  const list = store.listNotifications;
  useEffect(() => {
    let alive = true;
    async function load() {
      const unique = new Map<string, Notice>();
      const cursors = new Set<string>();
      let cursor: Cursor = null;
      do {
        const page: { items: Notice[]; nextCursor: Cursor } = await list(cursor);
        if (!alive) return;
        for (const n of page.items) if (n.deal_id && !unique.has(n.deal_id)) unique.set(n.deal_id, n);
        cursor = page.nextCursor;
        if (cursor && cursors.has(JSON.stringify(cursor))) throw new Error("Repeated cursor");
        if (cursor) cursors.add(JSON.stringify(cursor));
      } while (cursor);
      if (alive) setResult({ actor, items: [...unique.values()] });
    }
    void load().catch(() => { if (alive) setResult({ actor, items: [], error: "გარიგებების სია ვერ ჩაიტვირთა." }); });
    return () => { alive = false; };
  }, [list, actor]);
  return result?.actor === actor ? result : undefined;
}
function DealDetail({ store, actor, notice }: { store: Store; actor: string; notice: Notice }) {
  const { deal, error, refresh, pending } = useDeal(store, notice.deal_id!, actor);
  if (error) return <><p role="alert">{error}</p><Button variant="secondary" loading={pending} onClick={() => void refresh()}>ხელახლა ცდა</Button></>;
  if (!deal) return <p role="status">გარიგება იტვირთება…</p>;
  const request = store.getRequest(deal.request_id);
  const partner = store.userById(deal.buyer_id === actor ? deal.supplier_id : deal.buyer_id);
  const latest = [notice.created_at, deal.selected_at, deal.discuss_at, deal.terms_at, deal.progress_at, deal.complete_at, deal.cancelled_at, ...(deal.events || []).map(event => event.created_at)].filter((date): date is string => !!date).sort().at(-1);
  return <><div><h2>{request?.title || notice.title || "გარიგება"}</h2><p>{deal.buyer_id === actor ? "მომწოდებელი" : "მყიდველი"}: {partner?.company || partner?.name || "პარტნიორი"}</p></div><Status tone={deal.stage === "complete" ? "success" : "neutral"}>{dealActionLabel(deal.stage)}</Status><time dateTime={latest}>{dealDate(latest)}</time><Button variant="secondary" href={dealHref(deal.id)}>გარიგება</Button></>;
}
function DealRow(props: { store: Store; actor: string; notice: Notice }) {
  const row = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } });
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, []);
  return <li ref={row} className={styles.deal}>{visible ? <DealDetail {...props}/> : <p>გარიგება იტვირთება…</p>}</li>;
}
export function MyDeals({ store, actor }: { store: Store; actor: string }) {
  const result = useAccountDeals(store, actor);
  if (!result) return <p role="status">გარიგებები იტვირთება…</p>;
  if (result.error) return <p role="alert">{result.error}</p>;
  return result.items.length ? <ul className={styles.deals}>{result.items.map(notice => <DealRow key={notice.deal_id} store={store} actor={actor} notice={notice}/>)}</ul> : <div className="account-empty-state"><h2>გარიგებები ჯერ არ გაქვთ</h2></div>;
}
