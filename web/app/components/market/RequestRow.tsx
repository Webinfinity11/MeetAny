"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
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

export function RequestRow({ r, priority = false, tier, entranceIndex }: { r: RequestRowData; priority?: boolean; tier?: RequestTier; entranceIndex?: number }) {
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
    <article style={entranceIndex != null && entranceIndex < 12 ? { "--i": entranceIndex } as CSSProperties : undefined} data-enter={entranceIndex != null && entranceIndex < 12 ? "" : undefined} className={`ma-rcard ma-rcard--row request-card${tier ? ` request-card--${tier}` : ""}${r.photo && r.photo !== failedPhoto ? " request-card--photo" : ""}${r.isOwn ? " ma-rcard--mine" : closedLike ? " ma-rcard--closed" : ""}`}>
      {r.photo && r.photo !== failedPhoto ? <div className="request-card-visual" aria-hidden="true">
        <img src={r.photo} alt="" width={240} height={160} loading={priority ? "eager" : "lazy"} onError={() => setFailedPhoto(r.photo)} />
      </div> : null}
      <div className="request-card-content">
        {tier ? <span className={`request-tier-badge request-tier-badge--${tier}`}>{tier === "vip" ? "VIP" : "ტოპ"}</span> : null}
        <h2 className="ma-rcard__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        <p className="request-card-meta">
          {[categories[r.category] || r.category, r.cityLabel, r.quantity != null && r.unit ? `${r.quantity} ${units[r.unit] || r.unit}` : null, r.ownerName].filter(Boolean).join(" · ")}
          {r.isNew ? <> · <span className="request-tier-badge--new">ახალი</span></> : null}
          <span className="request-card-meta-status"> · <span>{r.offerCount} შეთავაზება</span>{deadline ? <> · <span className={urgent ? "request-card-meta-urgent" : undefined}>{deadline}</span></> : null}</span>
        </p>
      {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <div className="request-card-badges">
        {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        {r.showOwnOfferBadge && r.ownOfferStatus ? <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
      </div> : null}
      </div>
      <div className="request-card-status">
        <span className="request-card-offers"><strong>{r.offerCount}</strong> <span>შეთავაზება</span></span>
        {deadline ? <span className={urgent ? "request-card-urgent" : undefined}>{deadline}</span> : null}
      </div>
    </article>
  );
}
