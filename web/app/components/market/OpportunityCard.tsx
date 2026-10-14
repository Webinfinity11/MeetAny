"use client";

import { optimizable } from "../../lib/image";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categories, cities, currentCategory, units } from "../../lib/categories";
import { formatNumber } from "../../lib/format";
import { Icon } from "../Icon";
import { Badge } from "../ui/Badge";
import { RequestCatalogCover } from "./RequestCatalogCover";
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

export function OpportunityCard({ request: r, compact = false, offers, buyer, onSave, saved = false, horizontal = false }: OpportunityCardProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const category = categories[currentCategory(r.category)] || r.category;
  const budget = budgetLabel(r);
  const deadline = `${Math.max(0, r.daysLeft)} დღე დარჩა`;
  const facts = [category, r.cityLabel || cities[r.city] || r.city, ...(r.quantity != null ? [`${formatNumber(r.quantity)} ${r.unit ? units[r.unit] || r.unit : ""}`] : [])].join(" · ");
  return <article className={`${styles.card} ${compact ? styles.compact : `${catalogStyles.fullCard} ${styles.full}`} ${horizontal ? styles.horizontal : ""}`} data-request-id={r.id}>
    <div className={styles.visual}>
      {r.photo && failed !== r.photo ? <Image unoptimized={!optimizable(r.photo)} src={r.photo} alt="" width={96} height={72} sizes="96px" loading="lazy" onError={() => setFailed(r.photo)} /> : <RequestCatalogCover category={r.category} />}
      {(r.isNew || r.daysLeft <= 5) && <Badge status={r.isNew ? "success" : "warning"} className={styles.new}>{r.isNew ? "ახალი" : "სასწრაფო"}</Badge>}
    </div>
    <div className={styles.body}>
      <h3><Link className={`card-main-link ${styles.mainLink}`} href={href}>{r.title}</Link></h3>
      <p className={styles.facts} title={facts}>{facts}</p>
      {buyer && <span className="ma-sr-only">{buyer.name}{buyer.verified ? " · ვერიფიცირებული" : ""}</span>}
    </div>
    <div className={styles.bottom}>
      <div className={styles.summary}>
        <p>{offers !== undefined && <span>{offers} შეთავაზება<span aria-hidden="true"> · </span></span>}<span className={r.daysLeft <= 5 ? styles.warning : ""}>{deadline}</span></p>
        {(budget || compact && offers !== undefined) && <p className={styles.price}>{budget ?? "ფასი შეთანხმებით"}</p>}
      </div>
      {onSave && <button type="button" className={styles.save} aria-label={saved ? "შენახვის გაუქმება" : "მოთხოვნის შენახვა"} aria-pressed={saved} onClick={onSave}><Icon name="bookmark" /></button>}
    </div>
  </article>;
}
export function OpportunitySkeleton() {
  return <div className={`${styles.card} ${styles.compact}`} aria-hidden="true"><div className={`${styles.visual} ma-skel`} /><div className={styles.body}>{[0, 1, 2].map(i => <div className={`${styles.skeleton} ma-skel`} key={i} />)}</div></div>;
}
