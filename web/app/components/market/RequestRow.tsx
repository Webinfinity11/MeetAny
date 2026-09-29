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
  const hasPhoto = !!r.photo && r.photo !== failedPhoto;
  const quantity = r.quantity != null && r.unit ? `${r.quantity} ${units[r.unit] || r.unit}` : null;
  const entrance = entranceIndex != null && entranceIndex < 12;
  return (
    <article style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entrance ? "" : undefined} className={`request-card${hasPhoto ? " request-card--photo" : ""}${r.isOwn ? " request-card--mine" : closedLike ? " request-card--closed" : ""}`}>
      <div className="request-card__body">
        <p className="request-card__context"><span className="request-card__category">{categories[r.category] || r.category}</span>{r.isNew ? <span className="catalog-new">ახალი</span> : null}</p>
        <h2 className="request-card__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {r.body ? <p className="request-card__desc">{r.body}</p> : null}
        <ul className="request-card__meta" aria-label="დეტალები">
          {r.cityLabel ? <li><Icon name="map-pin" />{r.cityLabel}</li> : null}
          {quantity ? <li><Icon name="package" />{quantity}</li> : null}
          {r.ownerName ? <li><Icon name="building-2" />{r.ownerName}</li> : null}
        </ul>
        {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <div className="request-card__badges">
          {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
          {r.showOwnOfferBadge && r.ownOfferStatus ? <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
        </div> : null}
      </div>
      {hasPhoto ? <div className="request-card__photo" aria-hidden="true">
        <img src={r.photo!} alt="" width={240} height={240} loading={priority ? "eager" : "lazy"} onError={() => setFailedPhoto(r.photo)} />
      </div> : null}
      <div className="request-card__footer">
        <span className="request-card__offers"><Icon name="message-square" /><strong>{r.offerCount}</strong> შეთავაზება</span>
        {deadline ? <span className={`request-card__deadline${urgent ? " is-urgent" : ""}`}><Icon name="clock" />{deadline}</span> : null}
        {r.posted ? <span className="request-card__posted">{r.posted}</span> : null}
      </div>
    </article>
  );
}
