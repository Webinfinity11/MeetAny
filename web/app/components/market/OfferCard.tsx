
import { Button } from "../ui/Button";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { BusinessMarks } from "./CompanyBusiness";
import type { BusinessFeature } from "../../lib/business-client";
import { ReportButton } from "./ReportButton";

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
  feature?: BusinessFeature;
};

export function offerPrice(o: OfferCardData) {
 if(o.price==null || o.priceType==="negotiable")return "შეთანხმებით";
 return `${new Intl.NumberFormat("ka-GE",{maximumFractionDigits:2}).format(o.price)} ₾ · ${o.priceType==="unit"?"ერთეულის":"ჯამური"}`;
}

export function OfferCard({ o, onChoose, canChoose, canReport = false }: { o: OfferCardData; onChoose?: () => void; canChoose: boolean; canReport?: boolean }) {
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
          <BusinessMarks feature={o.feature} />
          <div className="ma-meta">
            <span>{o.city}</span>
            {o.deliveryDays != null ? <span>მიწოდება {o.deliveryDays} დღეში</span> : null}
          </div>
        </div>
      </header>
      <dl className="offer-terms"><div><dt>ფასი</dt><dd>{offerPrice(o)}</dd></div><div><dt>მიწოდება</dt><dd>{o.deliveryDays!=null?`${o.deliveryDays} დღე`:"დასაზუსტებელია"}</dd></div>{o.price!=null?<div><dt>დღგ</dt><dd>{o.vatIncluded?"ფასში შედის":"ფასში არ შედის"}</dd></div>:null}<div><dt>მიწოდების ხარჯი</dt><dd>{o.deliveryIncluded?"შედის":"დასაზუსტებელია"}</dd></div></dl>
      <p className="ma-ocard__body">{o.body}</p>
      <footer className="request-offer-actions">
        <Button variant="secondary" href={o.companyHref}><Icon name="building-2"/>კომპანიის ნახვა</Button>
        {canReport ? <ReportButton kind="offer" targetId={o.id} /> : null}
        {canChoose && o.status === "sent" ? <Button type="button" variant="primary" onClick={onChoose}><Icon name="check"/>შეთავაზების არჩევა</Button> : null}
      </footer>
    </article>
  );
}
