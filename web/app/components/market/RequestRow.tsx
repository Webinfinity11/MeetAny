import Link from "next/link";
import { Icon } from "../Icon";
import { categories, units } from "../../lib/categories";
import { neededByLabel } from "../../lib/format";

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
      <div className="request-card-category">{categories[r.category] || r.category}</div>
      <div className="request-card-heading">
        <h2 className="ma-rcard__title"><Link className="card-main-link" href={href}>{r.title}</Link></h2>
        {r.photo ? <Link className="request-card-photo" href={href} aria-label={`${r.title} — ფოტოს ნახვა`}><img src={r.photo} alt="" width={64} height={64} loading="lazy" /></Link> : null}
      </div>
      <p className="request-card-owner"><span>გამომქვეყნებელი</span>{r.ownerName}</p>
      <dl className="request-card-facts">
        <div><dt>სად არის საჭირო</dt><dd>{r.cityLabel}</dd></div>
        {r.quantity != null && r.unit ? <div><dt>რაოდენობა</dt><dd>{r.quantity} {units[r.unit]}</dd></div> : null}
        {r.neededBy ? <div className="request-card-needed"><dt>საჭიროა</dt><dd>{neededByLabel(r.neededBy)}</dd></div> : null}
      </dl>
      {r.isOwn || (r.showOwnOfferBadge && r.ownOfferStatus) ? <div className="request-card-badges">
        {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        {r.showOwnOfferBadge && r.ownOfferStatus ? <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}</span> : null}
      </div> : null}
      <div className="request-card-bottom">
        <div className="request-card-response">
          <span className="ma-rcard__offers"><b>{r.offerCount}</b> შეთავაზება</span>
          <span className="request-card-deadline"><span>{closedLike ? "სტატუსი" : "შეთავაზების ვადა"}</span><strong className={r.state === "open" && r.daysLeft < 4 ? "ma-rcard__left--soon" : ""}>{status}</strong></span>
        </div>
        <Link className="ma-btn ma-btn--secondary" href={href}>მოთხოვნის ნახვა <Icon name="arrow-right" /></Link>
      </div>
    </article>
  );
}
