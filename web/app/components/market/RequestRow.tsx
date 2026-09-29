"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { categories, units } from "../../lib/categories";

export type RequestRowData = {
  isNew?: boolean;
  id: string;
  title: string;
  body?: string;
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
  /** "დღეს" / "გუშინ" / "N დღის წინ", from createdAt; null before the client clock is known. */
  posted?: string | null;
};

export function RequestRow({ r, priority = false, entranceIndex }: { r: RequestRowData; priority?: boolean; entranceIndex?: number }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const closedLike = r.state === "closed" || r.state === "expired" || r.state === "chosen";
  // Deadline is shown only when it carries information: a closing state or seven days or fewer left.
  const deadline = r.state === "closed" ? "დახურულია"
    : r.state === "hidden" ? "დამალულია"
    : r.state === "expired" ? "ვადაგასულია"
      : r.state === "chosen" ? "მომწოდებელი არჩეულია"
        : r.daysLeft <= 0 ? "დღეს იწურება" : r.daysLeft <= 7 ? `კიდევ ${r.daysLeft} დღე` : null;
  const urgent = r.state === "open" && r.daysLeft <= 7;
  return (
    <article style={entranceIndex != null && entranceIndex < 12 ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entranceIndex != null && entranceIndex < 12 ? "" : undefined} className={`ma-rcard ma-rcard--row request-card${r.photo && r.photo !== failedPhoto ? " request-card--photo" : ""}${r.isOwn ? " ma-rcard--mine" : closedLike ? " ma-rcard--closed" : ""}`}>
      <div className="request-card-content">
        <div className="request-row-context"><span>{categories[r.category] || r.category}</span>{r.isNew ? <span className="request-card-new">ახალი</span> : null}<span>{r.posted}</span></div>
        <h2 className="ma-rcard__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {r.body ? <p className="request-row-description">{r.body}</p> : null}
        <p className="request-card-meta">{[r.cityLabel, r.quantity != null && r.unit ? `${r.quantity} ${units[r.unit] || r.unit}` : null, r.ownerName].filter(Boolean).join(" · ")}</p>
      {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <div className="request-card-badges">
        {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        {r.showOwnOfferBadge && r.ownOfferStatus ? <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
      </div> : null}
      </div>
      {r.photo && r.photo !== failedPhoto ? <div className="request-card-visual" aria-hidden="true">
        <img src={r.photo} alt="" width={240} height={160} loading={priority ? "eager" : "lazy"} onError={() => setFailedPhoto(r.photo)} />
      </div> : null}
      <div className="request-card-status">
        <span className="request-row-offers"><Icon name="message-square" /><strong>{r.offerCount}</strong> შეთავაზება</span>
        {deadline ? <span className={`request-row-deadline${urgent ? " request-card-urgent" : ""}`}><Icon name="clock" />{deadline}</span> : null}
        <Link className="ma-btn ma-btn--secondary request-row-detail" href={href} tabIndex={-1} aria-label={`${r.title} — დეტალების ნახვა`}>დეტალების ნახვა<Icon name="arrow-right" /></Link>
      </div>
    </article>
  );
}
