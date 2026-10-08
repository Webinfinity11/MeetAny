"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Store } from "../../../lib/market-client";
import { listMatching, type MatchingItem } from "../../../lib/matching-client";
import { cities } from "../../../lib/categories";
import { EmptyState } from "../../ui/Structure";
import { Icon } from "../../Icon";
import styles from "./Post.module.css";

export function MatchingSuppliers({ store, requestId }: { store: Store; requestId: string }) {
  const [items, setItems] = useState<MatchingItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const callRpc = store.callRpc;
  useEffect(() => {
    let active = true;
    void listMatching({ callRpc }, requestId, "", 0).then(rows => {
      if (active) setItems(rows);
    }).catch(() => { if (active) { setFailed(true); setItems([]); } });
    return () => { active = false; };
  }, [callRpc, requestId]);
  if (!items) return <p role="status">მომწოდებლები იტვირთება…</p>;
  if (!items.length) return <EmptyState icon="users" text={failed ? "შესაბამისი მომწოდებლების სია ამჟამად მიუწვდომელია. მოთხოვნა გამოქვეყნებულია." : "შესაბამისი მომწოდებლები ჯერ არ გამოჩენილან. მოთხოვნა ხელმისაწვდომია კატალოგში."} />;
  return <><ul className={styles.suppliers}>{items.map(item => <li key={item.id}>
    <span className={styles.avatar} aria-hidden="true">{item.company?.slice(0, 1)}</span>
    <div><Link href={`/companies/view/?id=${encodeURIComponent(item.id)}`}>{item.company}</Link><p>{cities[item.city] || item.city}{item.verified ? <Icon name="badge-check" /> : null}</p></div>
  </li>)}</ul><Link href={`/matching/?requestId=${encodeURIComponent(requestId)}`}>ყველა შესაბამისი მომწოდებელი</Link></>;
}

export function MatchingPreview({ store, category }: { store: Store; category: string }) {
  const items: { id: string; company?: string }[] = category ? store.listCompanies({ industry: category }).filter((company: { id: string }) => company.id !== store.currentUser()?.id) : [];
  return <div className={styles.matchingPreview}><p><strong>{items.length}</strong> შესაბამისი კომპანია</p><div className={styles.avatarRow}>{items.slice(0, 5).map(item => <span className={styles.avatar} key={item.id} title={item.company}>{item.company?.slice(0, 2)}</span>)}</div><p>ყველას ეცნობება გამოქვეყნებისთანავე</p></div>;
}
