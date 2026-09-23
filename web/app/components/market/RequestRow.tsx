"use client";

import { useState } from "react";
import Link from "next/link";
import { CategoryIcon } from "./CategoryIcon";
import type { RequestTier } from "../../lib/tier-demo";
import { categories, units } from "../../lib/categories";

export type RequestRowData = {
  isNew?: boolean;
  id: string;
  title: string;
  category: string;
  city: string;
  cityLabel: string;
  photo: string | null;
  quantity: number | null;
  unit: string | null;
  neededBy: string | null;
  ownerName: string;
  offerCount: number;
  state: "open" | "chosen" | "closed" | "expired" | "hidden";
  daysLeft: number;
  isOwn: boolean;
  ownOfferStatus?: string | null;
  showOwnOfferBadge: boolean;
};

export function RequestRow({ r, priority = false, tier, size = "compact" }: { r: RequestRowData; priority?: boolean; tier?: RequestTier; size?: "compact" | "featured" }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const closedLike = r.state === "closed" || r.state === "expired" || r.state === "chosen";
  const status = r.state === "closed" ? "დახურულია"
    : r.state === "expired" ? "ვადაგასულია"
      : r.state === "chosen" ? "მომწოდებელი არჩეულია"
        : r.daysLeft <= 0 ? "დღეს იწურება" : `კიდევ ${r.daysLeft} დღე`;
  return (
    <article className={`ma-rcard ma-rcard--row request-card${tier ? ` request-card--${tier}` : ""}${size === "featured" ? " request-card--featured" : ""}${r.isOwn ? " ma-rcard--mine" : closedLike ? " ma-rcard--closed" : ""}`}>
      <div className="request-card-visual" aria-hidden="true">
        {r.photo && r.photo !== failedPhoto
          ? <img src={r.photo} alt="" width={240} height={180} loading={priority ? "eager" : "lazy"} onError={() => setFailedPhoto(r.photo)} />
          : <CategoryIcon id={r.category} />}
      </div>
      <div className="request-card-content">
      <div className="request-card-context">{tier ? <span className={`request-tier-badge request-tier-badge--${tier}`}>{tier === "vip" ? "VIP" : "ტოპ"}</span> : null}{r.isNew ? <span className="request-tier-badge request-tier-badge--new">ახალი</span> : null}<span className="request-card-category"><CategoryIcon id={r.category} />{categories[r.category] || r.category}</span></div>
      <h2 className="ma-rcard__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
      <p className="request-card-owner">{r.ownerName}</p>
      <div className="request-card-meta">
        <span>{r.cityLabel}</span>
        {r.quantity != null && r.unit ? <span>{r.quantity} {units[r.unit]}</span> : null}
        <span className={r.state === "open" && r.daysLeft < 4 ? "ma-rcard__left--soon" : ""}>{status}</span>
        <span>{r.offerCount} შეთავაზება</span>
      </div>
      {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <div className="request-card-badges">
        {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        {r.showOwnOfferBadge && r.ownOfferStatus ? <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
      </div> : null}
      </div>
    </article>
  );
}
