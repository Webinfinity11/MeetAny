import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { priceTypes } from "../../lib/categories";

export type OfferCardData = {
  id: string;
  companyName: string;
  companyHref: string;
  city: string;
  createdAt: string;
  price: number | null;
  priceType: string;
  vatIncluded: boolean;
  deliveryDays: number | null;
  deliveryIncluded: boolean;
  body: string;
  status: string;
  isNew: boolean;
};

function priceLabel(o: OfferCardData): string {
  return o.price != null ? `${o.price.toLocaleString("ka-GE")} ₾` : "შეთანხმებით";
}

function summary(o: OfferCardData): string {
  const parts = [priceLabel(o), priceTypes[o.priceType] || "ფასი"];
  if (o.priceType !== "negotiable") parts.push(o.vatIncluded ? "დღგ-ს ჩათვლით" : "დღგ-ს გარეშე");
  else parts.push("დღგ დასაზუსტებელია");
  if (o.deliveryDays != null) parts.push(`მიწოდება ${o.deliveryDays} დღეში`);
  else parts.push("მიწოდების ვადა დასაზუსტებელია");
  if (o.deliveryIncluded && o.priceType !== "negotiable") parts.push("მიწოდება შედის ფასში");
  return parts.join(" · ");
}

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
        <CompanyAvatar name={o.companyName} />
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
          </div>
        </div>
        <div className="ma-ocard__price">
          <strong className="ma-ocard__amount">{priceLabel(o)}</strong>
          <span className="ma-ocard__unit">{priceTypes[o.priceType] || "ფასი"}</span>
        </div>
      </header>
      <p className="ma-proto-price">
        <strong>{priceLabel(o)}</strong> · {summary(o)}
      </p>
      <p className="ma-ocard__body">{o.body}</p>
      <Link className="ma-link" href={o.companyHref}>
        კომპანიის პროფილის ნახვა <Icon name="arrow-up-right" />
      </Link>
      <div className="ma-ocard__actions">
        {o.status === "chosen" ? (
          <p className="ma-note">
            <Icon name="check" />
            შეთავაზება არჩეულია. საკონტაქტო ინფორმაცია ქვემოთ გამოჩნდება.
          </p>
        ) : canChoose && o.status !== "declined" ? (
          <button type="button" className="ma-btn ma-btn--primary" onClick={onChoose}>
            შეთავაზების არჩევა
          </button>
        ) : null}
      </div>
    </article>
  );
}
