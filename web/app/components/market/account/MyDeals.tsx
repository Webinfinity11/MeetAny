"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import Link from "next/link";
import type { Store } from "../../../lib/market-client";
import { useDeal, dealHref, dealDate, dealActionLabel } from "../../../lib/deal-client";
import { Status } from "./shared";
import styles from "./account.module.css";
import { EmptyState } from "../../ui/Structure";
import { ListSkeleton } from "../Skeletons";
type Notice = { deal_action?: string | null; deal_id?: string | null; request_id: string; title?: string; created_at: string };
type Cursor = { created_at: string; id: string } | null;
/** Read the whole notification history: a deal may exist only on an older page. */
export function useAccountDeals(store: Store, actor: string) {
  const [result, setResult] = useState<{ actor: string; items: Notice[]; error?: string }>();
  const [retry, setRetry] = useState(0);
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
  }, [list, actor, retry]);
  const reload = () => { setResult(undefined); setRetry(value => value + 1); };
  return result?.actor === actor ? { ...result, reload } : undefined;
}
function DealDetail({ store, actor, notice }: { store: Store; actor: string; notice: Notice }) {
  const { deal, error, refresh, pending } = useDeal(store, notice.deal_id!, actor);
  if (error) return <EmptyState role="alert" title="გარიგება ვერ ჩაიტვირთა" text={error} action={<Button variant="secondary" loading={pending} onClick={() => void refresh()}>ხელახლა ცდა</Button>}/>;
  if (!deal) return <ListSkeleton compact label="გარიგება იტვირთება…"/>;
  const request = store.getRequest(deal.request_id);
  const partner = store.userById(deal.buyer_id === actor ? deal.supplier_id : deal.buyer_id);
  const latest = [notice.created_at, deal.selected_at, deal.discuss_at, deal.terms_at, deal.progress_at, deal.complete_at, deal.cancelled_at, ...(deal.events || []).map(event => event.created_at)].filter((date): date is string => !!date).sort().at(-1);
  return <><div><h2><Link className={styles.cardLink} href={dealHref(deal.id)}>{request?.title || notice.title || "გარიგება"}</Link></h2><p>{deal.buyer_id === actor ? "მომწოდებელი" : "მყიდველი"}: {partner?.company || partner?.name || "პარტნიორი"}</p></div><Status tone={deal.stage === "complete" ? "success" : "neutral"}>{dealActionLabel(deal.stage)}</Status><time dateTime={latest}>{dealDate(latest)}</time><Button variant="secondary" href={dealHref(deal.id)}>გარიგება</Button></>;
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
  if (!result) return <ListSkeleton compact label="გარიგებები იტვირთება…"/>;
  if (result.error) return <EmptyState role="alert" icon="circle-alert" title="გარიგებები ვერ ჩაიტვირთა" text="სცადეთ ხელახლა." action={<Button variant="secondary" onClick={result.reload}>ხელახლა ცდა</Button>}/>;
  return result.items.length ? <ul className={styles.deals}>{result.items.map(notice => <DealRow key={notice.deal_id} store={store} actor={actor} notice={notice}/>)}</ul> : <EmptyState icon="handshake" title="გარიგებები ჯერ არ გაქვთ" text="მომწოდებლის არჩევის შემდეგ შეთანხმება და შესრულების ეტაპები აქ გამოჩნდება." action={<Button variant="secondary" href="/account/?space=buy&tab=requests">ჩემი მოთხოვნები</Button>}/>;
}
