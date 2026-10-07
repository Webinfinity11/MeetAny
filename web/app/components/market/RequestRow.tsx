"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { categories, currentCategory, units } from "../../lib/categories";
import { Icon } from "../Icon";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { RequestCatalogCover } from "./RequestCatalogCover";

export type RequestRowData = {
  isNew?: boolean;
  offerCount?: number;
  canOffer?: boolean;
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
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const closedLike = r.state === "closed" || r.state === "expired" || r.state === "chosen";
  // Always say how long the request stays open — it is what a company weighs first.
  const deadline = r.state === "closed" ? "დახურულია"
    : r.state === "hidden" ? "დამალულია"
    : r.state === "expired" ? "ვადაგასულია"
      : r.state === "chosen" ? "მომწოდებელი არჩეულია"
        : r.daysLeft <= 0 ? "დღეს იწურება" : `${r.daysLeft} დღე დარჩა`;
  const urgent = r.state === "open" && r.daysLeft <= 5;
  const hasPhoto = !!r.photo && r.photo !== failedPhoto;
  const quantity = r.quantity != null && r.unit ? `${r.quantity} ${units[r.unit] || r.unit}` : null;
  const entrance = entranceIndex != null && entranceIndex < 12;
  const category = currentCategory(r.category);
  return (
    <article style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entrance ? "" : undefined} className={`request-card${hasPhoto ? " request-card--photo" : ""}${r.isOwn ? " request-card--mine" : closedLike ? " request-card--closed" : ""}`}>
      <div className="request-card__visual">
        {hasPhoto ? <img src={r.photo!} alt="" width={480} height={240} style={{ opacity: loadedPhoto === r.photo ? 1 : 0 }} loading={priority ? "eager" : "lazy"} onLoad={() => setLoadedPhoto(r.photo)} onError={() => setFailedPhoto(r.photo)} /> : <RequestCatalogCover category={r.category} />}
        {r.isNew ? <Badge status="success" className="request-card__badge">ახალი</Badge> : null}
      </div>
      <div className="request-card__body">
        <h2 className="request-card__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        <span className="request-card__category">{categories[category] || r.category}</span>
        <p className="request-card__owner"><span className="request-card__avatar" aria-hidden="true">{r.ownerName.slice(0, 1)}</span>{r.ownerName}</p>
        <ul className="request-card__facts" aria-label="მოთხოვნის დეტალები">
          {r.cityLabel ? <li><Icon name="map-pin" />{r.cityLabel}</li> : null}
          {quantity ? <li><Icon name="package" />{quantity}</li> : null}
        </ul>
        <div className="request-card__bottom">
          <div className="request-card__summary">
            <span className={urgent ? "is-urgent" : ""}><Icon name="clock" />{deadline}</span>
            <span><Icon name="message-square" />{r.offerCount ?? 0} შეთავაზება</span>
          </div>
          <div className="catalog-card-actions">
            <Button variant="secondary" href={href}>დეტალები</Button>
            {r.canOffer ? <Button variant="primary" href={`${href}#send-offer`}>შეთავაზება</Button> : null}
          </div>
        </div>
        {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <p className="request-card__status">
          {r.isOwn ? <span className="is-own">შენი მოთხოვნა</span> : null}
          {r.showOwnOfferBadge && r.ownOfferStatus ? <span className="is-own">შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
        </p> : null}
      </div>
    </article>
  );
}
