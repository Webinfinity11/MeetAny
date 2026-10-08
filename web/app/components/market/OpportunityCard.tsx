"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categories, cities, currentCategory, units } from "../../lib/categories";
import { formatNumber } from "../../lib/format";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { RequestCatalogCover } from "./RequestCatalogCover";
import catalogStyles from "./catalog/Catalog.module.css";
import styles from "./OpportunityCard.module.css";

export interface OpportunityRequest {
  id: string; title: string; category: string; city: string; cityLabel?: string;
  photo: string | null; quantity: number | null; unit: string | null;
  body?: string; daysLeft: number; isNew?: boolean;
}
export interface OpportunityCardProps {
  request: OpportunityRequest; compact?: boolean; offers?: number;
  buyer?: { name: string; verified: boolean }; onSave?: () => void; saved?: boolean; canOffer?: boolean;
}

export function OpportunityCard({ request: r, compact = false, offers, buyer, onSave, saved = false, canOffer = false }: OpportunityCardProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const category = categories[currentCategory(r.category)] || r.category;
  const deadline = `${Math.max(0, r.daysLeft)} დღე დარჩა`;
  return <article className={`${styles.card} ${compact ? styles.compact : catalogStyles.fullCard}`} data-request-id={r.id}>
    <div className={styles.visual}>
      {r.photo && failed !== r.photo ? <Image unoptimized src={r.photo} alt="" width={480} height={300} loading="lazy" onError={() => setFailed(r.photo)} /> : <RequestCatalogCover category={r.category} />}
      {compact ? r.isNew && <span className={styles.new}>ახალი</span> : <span className={`${styles.new} ${r.isNew ? "" : r.daysLeft <= 5 ? catalogStyles.urgent : catalogStyles.active}`}>{r.isNew ? "ახალი" : r.daysLeft <= 5 ? "სასწრაფო" : "აქტიური"}</span>}
      {compact ? <div className={styles.chips}><span title={category}>{category}</span><span className={r.daysLeft <= 5 ? styles.warning : ""}>{deadline}</span></div>
        : <><div className={styles.chips}><span title={category}>{category}</span></div>{onSave && <button type="button" className={styles.save} aria-label={saved ? "შენახვიდან წაშლა" : "მოთხოვნის შენახვა"} aria-pressed={saved} onClick={onSave}><Icon name="bookmark" /></button>}</>}
    </div>
    <div className={styles.body}>
      <h3><Link className={styles.mainLink} href={href}>{r.title}</Link></h3>
      {!compact && <>{r.body && <p className={`${styles.description} ${catalogStyles.description}`}>{r.body}</p>}{buyer && <p className={styles.buyer}><span>{buyer.name.slice(0, 1)}</span>{buyer.name}{buyer.verified && <span aria-label="ვერიფიცირებული"><Icon name="badge-check" /></span>}</p>}</>}
      <ul className={styles.facts}><li><Icon name="map-pin" />{r.cityLabel || cities[r.city] || r.city}</li>{r.quantity != null && <li><Icon name="package" />{formatNumber(r.quantity)} {r.unit ? units[r.unit] || r.unit : ""}</li>}</ul>
      {!compact && <div className={styles.bottom}><div className={styles.summary}><span className={r.daysLeft <= 5 ? styles.warning : ""}><Icon name="calendar" />{deadline}</span>{offers !== undefined && <span><Icon name="message-square" />{offers} შეთავაზება</span>}</div><div className={styles.actions}><Button variant="secondary" href={href}>დეტალები</Button>{canOffer && <Button href={`/offers/new/?requestId=${encodeURIComponent(r.id)}`}>შეთავაზება</Button>}</div></div>}
    </div>
  </article>;
}
export function OpportunitySkeleton() {
  return <div className={`${styles.card} ${styles.compact}`} aria-hidden="true"><div className={`${styles.visual} ma-skel`} /><div className={styles.body}>{[0, 1, 2].map(i => <div className={`${styles.skeleton} ma-skel`} key={i} />)}</div></div>;
}
