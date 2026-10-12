
import type { Store } from "../../lib/market-client";
import {FileAttachments} from "./FileAttachments";
import { dealDate, money, offerStatusLabel } from "../../lib/deal-client";
import { OfferDescription } from "./offer/OfferDescription";
import flowStyles from "./offer/OfferFlow.module.css";
import { Button } from "../ui/Button";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { BusinessMarks } from "./CompanyBusiness";
import type { BusinessFeature } from "../../lib/business-client";
import { ReportButton } from "./ReportButton";
import { MessageButton } from "./ChatPopup";

export type OfferCardData = {
  id: string;
  companyName: string;
  logoUrl?: string | null;
  companyHref: string;
  city: string;
  createdAt: string;
  deliveryDays: number | null;
  price?: number | null;
  priceType?: string;
  vatIncluded?: boolean;
  deliveryIncluded?: boolean;
  body: string;
  status: string;
  isNew: boolean;
  companyId?: string;
  updatedAt?: string;
  paymentTerms?: string | null;
  validUntil?: string | null;
  commercialTerms?: string[];
  feature?: BusinessFeature;
};

export function offerPrice(o: OfferCardData) {
 if(o.price==null || o.priceType==="negotiable")return "შეთანხმებით";
 return `${money(o.price)}${o.priceType==="unit"?" / ერთეული":""}`;
}

export function OfferCard({ store,o, onChoose, canChoose, canReport = false, messageTarget }: { store?:Store; o: OfferCardData; onChoose?: () => void; canChoose: boolean; canReport?: boolean; messageTarget?: { companyId: string; requestId: string } }) {
  const cls =
    o.status === "chosen"
      ? " ma-ocard--chosen"
      : o.status === "declined"
        ? " ma-ocard--declined"
        : o.isNew
          ? " ma-ocard--new"
          : "";
  return (
    <article className={`ma-ocard${cls} ${flowStyles.detailCard}`}>
      <header className="ma-ocard__head">
        <CompanyAvatar name={o.companyName} logoUrl={o.logoUrl} />
        <div className="ma-ocard__who">
          <div className="ma-ocard__name-row">
            <Link className="ma-ocard__name" href={o.companyHref}>
              {o.companyName}
            </Link>
            {o.status === "chosen" ? <span className="ma-badge ma-badge--success">{offerStatusLabel("chosen")}</span> : null}
            {o.status === "declined" ? <span className="ma-badge ma-badge--neutral">{offerStatusLabel("declined")}</span> : null}
            {o.isNew && o.status === "sent" ? <span className="ma-badge ma-badge--success">ახალი</span> : null}
          </div>
          <BusinessMarks feature={o.feature} />
          {o.city ? <div className="ma-meta"><span>{o.city}</span></div> : null}
        </div>
      </header>
      <dl className="offer-terms offer-terms--compact">
        <div className="offer-terms__price"><dt>{o.priceType==="unit"?"ერთეულის ფასი":"ჯამური ფასი"}</dt><dd>{offerPrice(o)}</dd></div>
        <div><dt>მიწოდების ვადა</dt><dd>{o.deliveryDays!=null?`${o.deliveryDays} დღე`:"დასაზუსტებელია"}</dd></div>
        {o.validUntil ? <div><dt>ძალაშია</dt><dd>{dealDate(o.validUntil)}</dd></div> : null}
      </dl>
      {o.commercialTerms?.length ? <div className={flowStyles.termsList}><span>მოიცავს</span><ul>{o.commercialTerms.map(term => <li key={term}><Icon name="check"/>{term}</li>)}</ul></div> : null}
      <p className={flowStyles.detailNote}>{offerNotes(o)}</p>
      <OfferDescription body={o.body}/>{store?<FileAttachments store={store} kind="offer" target={o.id}/>:null}
      <footer className="request-offer-actions">
        {canChoose && o.status === "sent" ? <Button type="button" variant="primary" onClick={onChoose}><Icon name="check"/>შეთავაზების არჩევა</Button> : null}
        {messageTarget ? <MessageButton {...messageTarget} variant="secondary" /> : null}
        {canReport ? <ReportButton kind="offer" targetId={o.id} /> : null}
      </footer>
    </article>
  );
}

/** VAT, delivery cost and payment as one line; what is still open is named once. */
export function offerNotes(o: OfferCardData) {
  const priced = o.price != null && o.priceType !== "negotiable";
  const known = [priced ? o.vatIncluded ? "დღგ ფასში შედის" : "დღგ ფასში არ შედის" : "", o.deliveryIncluded ? "მიწოდება ფასში შედის" : "", o.paymentTerms ? `გადახდა: ${o.paymentTerms}` : ""].filter(Boolean);
  const open = [priced ? "" : "დღგ", o.deliveryIncluded ? "" : "მიწოდების ხარჯი", o.paymentTerms ? "" : "გადახდა"].filter(Boolean);
  return [...known, open.length ? `${open.join(", ")} — დასაზუსტებელი` : ""].filter(Boolean).join(" · ");
}
