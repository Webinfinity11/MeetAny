"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { categories, categoryIcon, currentCategory, units } from "../../lib/categories";
import { Icon } from "../Icon";
import { DuoIcon } from "../ui/DuoIcon";

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
  // Many requests repeat the title as the first line of the description; don't print it twice.
  const norm = (text: string) => text.toLocaleLowerCase("ka").replace(/[\s.,!?–—-]+/g, " ").trim();
  const body = r.body && !norm(r.body).startsWith(norm(r.title)) ? r.body : r.body && norm(r.body).length > norm(r.title).length + 12 ? r.body.slice(r.title.length).replace(/^[\s.,:;–—-]+/, "") : "";
  const urgent = r.state === "open" && r.daysLeft <= 7;
  const hasPhoto = !!r.photo && r.photo !== failedPhoto;
  const quantity = r.quantity != null && r.unit ? `${r.quantity} ${units[r.unit] || r.unit}` : null;
  const entrance = entranceIndex != null && entranceIndex < 12;
  const category = currentCategory(r.category);
  return (
    <article style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entrance ? "" : undefined} className={`request-card${hasPhoto ? " request-card--photo" : ""}${r.isOwn ? " request-card--mine" : closedLike ? " request-card--closed" : ""}`}>
      <div className="request-card__visual" aria-hidden="true">
        <DuoIcon name={categoryIcon[category] || "file-text"} size={30} />
        {hasPhoto ? <img src={r.photo!} alt="" width={144} height={144} style={{ opacity: loadedPhoto === r.photo ? 1 : 0 }} loading={priority ? "eager" : "lazy"} onLoad={() => setLoadedPhoto(r.photo)} onError={() => setFailedPhoto(r.photo)} /> : null}
      </div>
      <div className="request-card__body">
        <p className="request-card__context"><span>{categories[category] || r.category}</span>{r.posted ? <span className="request-card__posted">{r.posted}</span> : null}{r.isNew ? <span className="request-card__new">ახალი</span> : null}</p>
        <h2 className="request-card__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {body ? <p className="request-card__desc">{body}</p> : null}
        <p className="request-card__owner">{r.ownerName}</p>
        <div className="request-card__footer">
          <ul className="request-card__facts" aria-label="მოთხოვნის დეტალები">
            {r.cityLabel ? <li><Icon name="map-pin" />{r.cityLabel}</li> : null}
            {quantity ? <li><Icon name="package" />{quantity}</li> : null}
            <li className={urgent ? "is-urgent" : "request-card__deadline"}><Icon name="clock" />{deadline}</li>
          </ul>
          <Link className="request-card__open" href={href} aria-label={`დეტალების ნახვა: ${r.title}`}><Icon name="file-text" />დეტალების ნახვა</Link>
        </div>
        {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <p className="request-card__status">
          {r.isOwn ? <span className="is-own">შენი მოთხოვნა</span> : null}
          {r.showOwnOfferBadge && r.ownOfferStatus ? <span className="is-own">შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
        </p> : null}
      </div>
    </article>
  );
}
