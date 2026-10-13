"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Store } from "../../../lib/market-client";
import { countMatchingSuppliers, listMatching, type MatchingItem } from "../../../lib/matching-client";
import { cities } from "../../../lib/categories";
import { EmptyState } from "../../ui/Structure";
import { Badge } from "../../ui/Badge";
import { Icon } from "../../Icon";
import styles from "./Post.module.css";

export function MatchingSuppliers({ store, requestId }: { store: Store; requestId: string }) {
  const [items, setItems] = useState<MatchingItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const callRpc = store.callRpc;
  useEffect(() => {
    let active = true;
    void listMatching({ callRpc }, requestId, "", 0, 100).then(rows => {
      if (active) setItems(rows);
    }).catch(() => { if (active) { setFailed(true); setItems([]); } });
    return () => { active = false; };
  }, [callRpc, requestId]);
  if (!items) return <p role="status">მომწოდებლები იტვირთება…</p>;
  if (!items.length) return <EmptyState icon="users" text={failed ? "შესაბამისი მომწოდებლების სია ამჟამად მიუწვდომელია. მოთხოვნა გამოქვეყნებულია." : "ვერიფიცირებული მომწოდებელი ჯერ არ არის; მოთხოვნა კატალოგში მაინც გამოჩნდება."} />;
  // Similar-direction suppliers are listed after the exact ones; only the alerted ones count as "sent".
  const notified = items.filter(item => item.notified).length;
  return <>{notified ? <p>მოთხოვნა გაეგზავნა <strong>{notified}</strong> ვერიფიცირებულ მომწოდებელს</p> : <p><strong>{items.length}</strong> შესაბამისი ვერიფიცირებული მომწოდებელი</p>}<ul className={styles.suppliers}>{items.map(item => <li key={item.id}>
    <span className={styles.avatar} aria-hidden="true">{item.company?.slice(0, 1)}</span>
    <div><Link href={`/companies/view/?id=${encodeURIComponent(item.id)}`}>{item.company}</Link><p>{cities[item.city] || item.city}{item.verified ? <Icon name="badge-check" /> : null}{item.match === "similar" ? <Badge status="muted">მსგავსი მიმართულება</Badge> : null}</p></div>
  </li>)}</ul><Link href={`/matching/?requestId=${encodeURIComponent(requestId)}`}>ყველა შესაბამისი მომწოდებელი</Link></>;
}

export function MatchingPreview({ store, category }: { store: Store; category: string }) {
  const [counted, setCounted] = useState<{ category: string; count: number | null } | null>(null);
  const callRpc = store.callRpc;
  useEffect(() => {
    if (!category) return;
    let active = true;
    countMatchingSuppliers({ callRpc }, category).then(count => { if (active) setCounted({ category, count }); }, () => { if (active) setCounted({ category, count: null }); });
    return () => { active = false; };
  }, [callRpc, category]);
  if (!category) return <div className={styles.matchingPreview}><p>აირჩიეთ კატეგორია — ვაჩვენებთ, რამდენ მომწოდებელს ეცნობება.</p></div>;
  if (counted?.category !== category) return <div className={styles.matchingPreview} role="status"><p>ითვლება…</p></div>;
  if (counted.count === null) return <div className={styles.matchingPreview}><p>მომწოდებლების რაოდენობა ამჟამად მიუწვდომელია. მოთხოვნა მაინც გამოქვეყნდება.</p></div>;
  if (!counted.count) return <div className={styles.matchingPreview}><p>ვერიფიცირებული მომწოდებელი ჯერ არ არის; მოთხოვნა კატალოგში მაინც გამოჩნდება.</p></div>;
  return <div className={styles.matchingPreview}><p><strong>{counted.count}</strong>ვერიფიცირებული მომწოდებელი</p><p>გამოქვეყნებისას მათ ეცნობებათ.</p></div>;
}
