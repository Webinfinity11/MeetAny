"use client";

import Link from "next/link";
import { CompanyListingCard, type CompanyListingData } from "../market/CompanyListingCard";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import styles from "./HomeSections.module.css";

type Listed = Omit<CompanyListingData, "name" | "stats"> & { name?: string; company?: string; createdAt: string };

/** Verified companies from the public snapshot: those with a logo or photo and a description first; 3 or 6 cards, never an orphan row. */
export function HomeCompanies({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  if (!ready || !available || !store) return null;
  const score = (c: Listed) => (c.logoUrl || c.gallery?.length ? 2 : 0) + (c.about ? 1 : 0);
  const verified = (store.listCompanies({ verified: true }) as Listed[])
    .sort((a, b) => score(b) - score(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const picked = verified.slice(0, verified.length >= 6 ? 6 : 3);
  if (picked.length < 3) return null;
  return <section className={`home-wrap ${styles.block}`} aria-labelledby="home-companies-title">
    <div className="home-section-head"><div className={styles.intro}><h2 id="home-companies-title">ვერიფიცირებული კომპანიები</h2><p>გაეცანით გადამოწმებული კომპანიების საქმიანობას.</p></div><Link className="home-text-link" href="/companies/">ყველა კომპანია</Link></div>
    <div className={styles.companies}>{picked.map(c => <CompanyListingCard key={c.id} catalog c={{ ...c, name: c.company || c.name || "", phone: undefined, stats: store.companyStats(c.id) }} />)}</div>
  </section>;
}
