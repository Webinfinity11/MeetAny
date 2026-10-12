"use client";

import { optimizable } from "../../lib/image";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categories, cities, currentCategory, units } from "../../lib/categories";
import { formatNumber } from "../../lib/format";
import { Icon } from "../Icon";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { RequestCatalogCover } from "./RequestCatalogCover";
import { avatarInitials } from "../../lib/avatar-initials";
import catalogStyles from "./catalog/Catalog.module.css";
import styles from "./OpportunityCard.module.css";

export interface OpportunityRequest {
  id: string; title: string; category: string; city: string; cityLabel?: string;
  photo: string | null; quantity: number | null; unit: string | null;
  body?: string; daysLeft: number; isNew?: boolean;
  budgetType?: "range" | "exact" | null; budgetMin?: number | null; budgetMax?: number | null;
}
/** Public budget text: range "₾1,000–1,800", exact "₾25,000", otherwise null (no public budget). */
export function budgetLabel(r: Pick<OpportunityRequest, "budgetType" | "budgetMin" | "budgetMax">): string | null {
  if (r.budgetMin == null) return null;
  if (r.budgetType === "range" && r.budgetMax != null) return `₾${formatNumber(r.budgetMin)}–${formatNumber(r.budgetMax)}`;
  if (r.budgetType === "exact") return `₾${formatNumber(r.budgetMin)}`;
  return null;
}
export interface OpportunityCardProps {
  request: OpportunityRequest; compact?: boolean; offers?: number;
  buyer?: { name: string; verified: boolean }; onSave?: () => void; saved?: boolean; canOffer?: boolean; guest?: boolean; horizontal?: boolean;
}

export function OpportunityCard({ request: r, compact = false, offers, buyer, onSave, saved = false, canOffer = false, guest = false, horizontal = false }: OpportunityCardProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const category = categories[currentCategory(r.category)] || r.category;
  const budget = budgetLabel(r);
  const deadline = `${Math.max(0, r.daysLeft)} დღე დარჩა`;
  return <article className={`${styles.card} ${compact ? styles.compact : `${catalogStyles.fullCard} ${styles.full} ${horizontal ? styles.horizontal : ""}`}`} data-request-id={r.id}>
    <div className={styles.visual}>
      {r.photo && failed !== r.photo ? <Image unoptimized={!optimizable(r.photo)} src={r.photo} alt="" width={480} height={300} sizes="(max-width: 720px) 100vw, 480px" loading="lazy" onError={() => setFailed(r.photo)} /> : <RequestCatalogCover category={r.category} />}
      {compact ? r.isNew && <Badge status="success" className={styles.new}>ახალი</Badge> : (r.isNew || r.daysLeft <= 5) && <Badge status={r.isNew ? "success" : "warning"} className={styles.new}>{r.isNew ? "ახალი" : "სასწრაფო"}</Badge>}
      {compact ? <div className={styles.chips}><span title={category}>{category}</span><span className={r.daysLeft <= 5 ? styles.warning : ""}>{deadline}</span></div>
        : <>{onSave && <button type="button" className={styles.save} aria-label={saved ? "შენახვის გაუქმება" : "მოთხოვნის შენახვა"} aria-pressed={saved} onClick={onSave}><Icon name="bookmark" /></button>}</>}
    </div>
    <div className={styles.body}>
      <h3><Link className={styles.mainLink} href={href}>{r.title}</Link></h3>
      {!compact && <><span className={styles.category}>{category}</span>{buyer && <p className={styles.buyer}><span aria-hidden="true">{avatarInitials(buyer.name)}</span>{buyer.name}{buyer.verified && <span aria-label="ვერიფიცირებული"><Icon name="badge-check" /></span>}</p>}</>}
      <ul className={styles.facts}><li><Icon name="map-pin" />{r.cityLabel || cities[r.city] || r.city}</li>{r.quantity != null && <li><Icon name="package" />{formatNumber(r.quantity)} {r.unit ? units[r.unit] || r.unit : ""}</li>}{budget && <li><Icon name="wallet" />{budget}</li>}</ul>
      {!compact && <div className={styles.bottom}><div className={styles.summary}><span className={r.daysLeft <= 5 ? styles.warning : ""}><Icon name="calendar" />{deadline}</span>{offers !== undefined && <span><Icon name="message-square" />{offers} შეთავაზება</span>}</div><div className={styles.actions}>{canOffer || guest ? <Button href={guest ? `/account/?next=${encodeURIComponent(`/offers/new/?requestId=${encodeURIComponent(r.id)}`)}` : `/offers/new/?requestId=${encodeURIComponent(r.id)}`}>შეთავაზების გაგზავნა</Button> : <Button variant="secondary" href={href}>მოთხოვნის ნახვა</Button>}</div></div>}
    </div>
  </article>;
}
export function OpportunitySkeleton() {
  return <div className={`${styles.card} ${styles.compact}`} aria-hidden="true"><div className={`${styles.visual} ma-skel`} /><div className={styles.body}>{[0, 1, 2].map(i => <div className={`${styles.skeleton} ma-skel`} key={i} />)}</div></div>;
}
