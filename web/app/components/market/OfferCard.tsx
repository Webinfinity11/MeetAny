import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";

export type OfferCardData = {
  id: string;
  companyName: string;
  logoUrl?: string | null;
  companyHref: string;
  city: string;
  createdAt: string;
  deliveryDays: number | null;
  body: string;
  status: string;
  isNew: boolean;
};

// No price field (owner decision 2026-09-22: B2B pricing isn't a fixed number, so the offer
// is text plus an optional delivery time — see db/CONTRACT.md "შეთავაზება ფასის გარეშე").
export function OfferCard({ o, onChoose, canChoose }: { o: OfferCardData; onChoose?: () => void; canChoose: boolean }) {
  const cls =
    o.status === "chosen"
      ? " ma-ocard--chosen"
      : o.status === "declined"
        ? " ma-ocard--declined"
        : o.isNew
          ? " ma-ocard--new"
          : "";
  return (
    <article className={`ma-ocard${cls}`}>
      <header className="ma-ocard__head">
        <CompanyAvatar name={o.companyName} logoUrl={o.logoUrl} />
        <div className="ma-ocard__who">
          <div className="ma-ocard__name-row">
            <Link className="ma-ocard__name" href={o.companyHref}>
              {o.companyName}
            </Link>
            {o.status === "chosen" ? <span className="ma-badge ma-badge--success">არჩეულია</span> : null}
            {o.status === "declined" ? <span className="ma-badge ma-badge--neutral">არ აირჩიეს</span> : null}
            {o.isNew && o.status === "sent" ? <span className="ma-badge ma-badge--accent">ახალი</span> : null}
          </div>
          <div className="ma-meta">
            <span>{o.city}</span>
            {o.deliveryDays != null ? <span>მიწოდება {o.deliveryDays} დღეში</span> : null}
          </div>
        </div>
      </header>
      <p className="ma-ocard__body">{o.body}</p>
      <Link className="ma-link" href={o.companyHref}>
        კომპანიის პროფილის ნახვა <Icon name="arrow-up-right" />
      </Link>
      {o.status === "chosen" || (canChoose && o.status !== "declined") ? <div className="ma-ocard__actions">
        {o.status === "chosen" ? (
          <p className="ma-note">
            <Icon name="check" />
            შეთავაზება არჩეულია.
          </p>
        ) : canChoose && o.status !== "declined" ? (
          <button type="button" className="ma-btn ma-btn--primary" onClick={onChoose}>
            შეთავაზების არჩევა
          </button>
        ) : null}
      </div> : null}
    </article>
  );
}
