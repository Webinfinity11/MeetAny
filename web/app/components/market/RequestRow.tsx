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
  return (
    <article className={`ma-rcard ma-rcard--row${r.isOwn ? " ma-rcard--mine" : closedLike ? " ma-rcard--closed" : ""}`}>
      <div className="ma-stack">
        <div className="request-row-heading">
          <h2 className="ma-rcard__title"><Link className="ma-proto-rowtitle" href={href}>{r.title}</Link></h2>
          {r.photo ? <img className="ma-rcard__photo" src={r.photo} alt="" width={48} height={48} loading="lazy" /> : null}
        </div>
        <div className="ma-rcard__kicker">
          <span className="ma-small ma-muted">{categories[r.category] || r.category}</span>
          <span className="ma-rcard__time">{r.ownerName}</span>
        </div>
        {r.isOwn ? <span className="ma-badge ma-badge--info">შენი მოთხოვნა</span> : null}
        <div className="ma-facts">
          <span className="ma-fact">
            <Icon name="map-pin" />
            {r.cityLabel}
          </span>
          {r.quantity != null && r.unit ? (
            <span className="ma-fact">
              <Icon name="package" />
              {r.quantity} {units[r.unit]}
            </span>
          ) : null}
        </div>
        {r.neededBy ? <div className="ma-small ma-muted">საჭიროა {neededByLabel(r.neededBy)}</div> : null}
      </div>
      <div className="ma-proto-rowend">
        <span className="ma-rcard__offers">
          <b>{r.offerCount}</b> შეთავაზება
        </span>
        <span className={`ma-small ${r.state === "open" && r.daysLeft < 4 ? "ma-rcard__left--soon" : "ma-muted"}`}>
          {r.state === "closed"
            ? "დახურულია"
            : r.state === "expired"
              ? "ვადაგასულია"
              : r.state === "chosen"
                ? "მომწოდებელი არჩეულია"
                : `დარჩა ${r.daysLeft} დღე`}
        </span>
        {r.showOwnOfferBadge && r.ownOfferStatus ? (
          <span className={`ma-badge ma-badge--${r.ownOfferStatus === "chosen" ? "success" : "info"}`}>
            შენი შეთავაზება {r.ownOfferStatus === "chosen" ? "არჩეულია" : "გაგზავნილია"}
          </span>
        ) : null}
        <Link className="ma-btn ma-btn--secondary" href={href}>
          დეტალების ნახვა <Icon name="arrow-right" />
        </Link>
      </div>
    </article>
  );
}
