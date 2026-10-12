"use client";
import { useEffect, useState } from "react";
import { Button } from "../../ui/Button";
import Link from "next/link";
import type { Store } from "../../../lib/market-client";
import { listMyDeals, dealHref, dealDate, dealActionLabel, type MyDeal } from "../../../lib/deal-client";
import { Status } from "./shared";
import styles from "./account.module.css";
import { EmptyState } from "../../ui/Structure";
import { ListSkeleton } from "../Skeletons";
/** The actor's deals from list_my_deals: both buyer and supplier, newest activity first. */
export function useAccountDeals(store: Store, actor: string) {
  const [result, setResult] = useState<{ actor: string; items: MyDeal[]; error?: string }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    listMyDeals(store).then(items => { if (alive) setResult({ actor, items }); }, () => { if (alive) setResult({ actor, items: [], error: "გარიგებების სია ვერ ჩაიტვირთა." }); });
    return () => { alive = false; };
  }, [store, actor, retry]);
  const reload = () => { setResult(undefined); setRetry(value => value + 1); };
  return result?.actor === actor ? { ...result, reload } : undefined;
}
function DealRow({ store, actor, deal }: { store: Store; actor: string; deal: MyDeal }) {
  const partner = store.userById(deal.buyer_id === actor ? deal.supplier_id : deal.buyer_id);
  return <li className={styles.deal}><div><h2><Link className={styles.cardLink} href={dealHref(deal.id)}>{deal.request_title || "გარიგება"}</Link></h2><p>{deal.buyer_id === actor ? "მომწოდებელი" : "მყიდველი"}: {partner?.company || partner?.name || "პარტნიორი"}</p></div><Status tone={deal.stage === "complete" ? "success" : "neutral"}>{dealActionLabel(deal.stage)}</Status><time dateTime={deal.latest_at}>{dealDate(deal.latest_at)}</time><Button variant="secondary" href={dealHref(deal.id)}>გარიგება</Button></li>;
}
export function MyDeals({ store, actor }: { store: Store; actor: string }) {
  const result = useAccountDeals(store, actor);
  if (!result) return <ListSkeleton compact label="გარიგებები იტვირთება…"/>;
  if (result.error) return <EmptyState role="alert" icon="circle-alert" title="გარიგებები ვერ ჩაიტვირთა" text="სცადეთ ხელახლა." action={<Button variant="secondary" onClick={result.reload}>ხელახლა ცდა</Button>}/>;
  return result.items.length ? <ul className={styles.deals}>{result.items.map(deal => <DealRow key={deal.id} store={store} actor={actor} deal={deal}/>)}</ul> : <EmptyState icon="handshake" title="გარიგებები ჯერ არ გაქვთ" text="მომწოდებლის არჩევის შემდეგ შეთანხმება და შესრულების ეტაპები აქ გამოჩნდება." action={<Button variant="secondary" href="/account/?space=buy&tab=requests">ჩემი მოთხოვნები</Button>}/>;
}
