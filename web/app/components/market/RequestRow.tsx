import Link from "next/link";
import { CategoryIcon } from "./CategoryIcon";
import { categories, units } from "../../lib/categories";

export type RequestRowData = {
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

export function RequestRow({ r }: { r: RequestRowData }) {
  const href = `/requests/view/?id=${encodeURIComponent(r.id)}`;
  const closedLike = r.state === "closed" || r.state === "expired" || r.state === "chosen";
  const status = r.state === "closed" ? "დახურულია"
    : r.state === "expired" ? "ვადაგასულია"
      : r.state === "chosen" ? "მომწოდებელი არჩეულია"
        : r.daysLeft <= 0 ? "დღეს იწურება" : `კიდევ ${r.daysLeft} დღე`;
  return (
    <article className={`ma-rcard ma-rcard--row request-card${r.isOwn ? " ma-rcard--mine" : closedLike ? " ma-rcard--closed" : ""}`}>
      <div className="request-card-context"><span className="request-card-category"><CategoryIcon id={r.category} />{categories[r.category] || r.category}</span><span aria-hidden="true">·</span><span>{r.ownerName}</span></div>
      <div className="request-card-heading">
        <h2 className="ma-rcard__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {r.photo ? <span className="request-card-photo"><img src={r.photo} alt="" width={64} height={64} loading="lazy" /></span> : null}
      </div>
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
    </article>
  );
}
