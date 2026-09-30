"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
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
  // Plain, text-first listing (like real job boards): no icon per fact, no slogans.
  const facts = [r.cityLabel, quantity, r.ownerName].filter(Boolean).join(" · ");
  const status = [`${r.offerCount} შეთავაზება`, deadline].filter(Boolean);
  return (
    <article style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entrance ? "" : undefined} className={`request-card${hasPhoto ? " request-card--photo" : ""}${r.isOwn ? " request-card--mine" : closedLike ? " request-card--closed" : ""}`}>
      <div className="request-card__body">
        <p className="request-card__context">{categories[r.category] || r.category}{r.posted ? ` · ${r.posted}` : ""}{r.isNew ? <span className="request-card__new">ახალი</span> : null}</p>
        <h2 className="request-card__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {body ? <p className="request-card__desc">{body}</p> : null}
        {facts ? <p className="request-card__facts">{facts}</p> : null}
        <p className="request-card__status">
          <span>{status[0]}</span>
          {status[1] ? <span className={urgent ? "is-urgent" : undefined}>{status[1]}</span> : null}
          {r.isOwn ? <span className="is-own">შენი მოთხოვნა</span> : null}
          {r.showOwnOfferBadge && r.ownOfferStatus ? <span className="is-own">შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
        </p>
      </div>
      {hasPhoto ? <div className="request-card__photo" aria-hidden="true">
        <img src={r.photo!} alt="" width={176} height={176} loading={priority ? "eager" : "lazy"} onError={() => setFailedPhoto(r.photo)} />
      </div> : null}
    </article>
  );
}
