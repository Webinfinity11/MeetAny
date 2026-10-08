
import { dealDate } from "../../lib/deal-client";
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
 return `${new Intl.NumberFormat("ka-GE",{maximumFractionDigits:2}).format(o.price)} ₾ · ${o.priceType==="unit"?"ერთეულის":"ჯამური"}`;
}

export function OfferCard({ o, onChoose, canChoose, canReport = false, messageTarget }: { o: OfferCardData; onChoose?: () => void; canChoose: boolean; canReport?: boolean; messageTarget?: { companyId: string; requestId: string } }) {
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
            {o.status === "chosen" ? <span className="ma-badge ma-badge--success">არჩეულია</span> : null}
            {o.status === "declined" ? <span className="ma-badge ma-badge--neutral">არ აირჩიეს</span> : null}
            {o.isNew && o.status === "sent" ? <span className="ma-badge ma-badge--success">ახალი</span> : null}
          </div>
          <BusinessMarks feature={o.feature} />
          {o.city ? <div className="ma-meta"><span>{o.city}</span></div> : null}
        </div>
      </header>
      <dl className="offer-terms offer-terms--compact">
        <div className="offer-terms__price"><dt>ფასი</dt><dd>{offerPrice(o)}{o.price!=null?<small>{o.vatIncluded?"დღგ ფასში შედის":"დღგ ფასში არ შედის"}</small>:null}</dd></div>
        <div><dt>მიწოდების ვადა</dt><dd>{o.deliveryDays!=null?`${o.deliveryDays} დღე`:"დასაზუსტებელია"}</dd></div>
        <div><dt>ძალაშია</dt><dd>{o.validUntil ? dealDate(o.validUntil) : "—"}</dd></div>
      </dl>
      {o.commercialTerms?.length ? <div className={flowStyles.termsList}><span>მოიცავს</span><ul>{o.commercialTerms.map(term => <li key={term}><Icon name="check"/>{term}</li>)}</ul></div> : null}
      {o.paymentTerms ? <p className={flowStyles.detailNote}>გადახდა: {o.paymentTerms}</p> : null}
      <p className={flowStyles.detailNote}>მიწოდების ხარჯი: {o.deliveryIncluded ? "შედის" : "დასაზუსტებელია"}</p>
      <OfferDescription body={o.body}/>
      <footer className="request-offer-actions">
        {canChoose && o.status === "sent" ? <Button type="button" variant="primary" onClick={onChoose}><Icon name="check"/>არჩევა</Button> : null}
        {messageTarget ? <MessageButton {...messageTarget} variant="secondary" /> : null}
        {canReport ? <ReportButton kind="offer" targetId={o.id} /> : null}
      </footer>
    </article>
  );
}
