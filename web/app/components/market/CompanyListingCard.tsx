import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { CompanyAvatar } from "./CompanyAvatar";
import type { CSSProperties } from "react";
import { CallButton } from "./CallButton";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";

export type CompanyListingData = {
  id: string;
  name: string;
  logoUrl?: string | null;
  industry: string;
  city: string;
  serviceCities: string[];
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  directions?: string | null;
  offers: string[];
  about: string;
  verified: boolean;
  phone?: string;
  stats: { sent: number; chosen: number };
};

export function CompanyListingCard({ c, entranceIndex }: { c: CompanyListingData; entranceIndex?: number }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  const cityIds = [...new Set((c.serviceCities.filter(Boolean).length ? c.serviceCities : [c.city]).filter(Boolean))];
  const places = cityIds.slice(0, 3).map(id => cities[id] || id).join(", ") + (cityIds.length > 3 ? ` +${cityIds.length - 3}` : "");
  const entrance = entranceIndex != null && entranceIndex < 12;
  return (
    <article className="company-card" data-enter={entrance ? "" : undefined} style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined}>
      <div className="company-card__head">
        <CompanyAvatar name={c.name} logoUrl={c.logoUrl} size="lg" />
        <div className="company-card__identity">
          <h3 className="company-card__name"><Link className="card-main-link" href={href}>{c.name}</Link></h3>
          <p className="company-card__industry">{categories[c.industry] || c.industry}</p>
        </div>
        <div className="company-card__save"><SaveCompanyButton id={c.id} icon /></div>
      </div>
      {c.about ? <p className="company-card__about">{c.about}</p> : null}
      {c.offers.length ? <ul className="company-card__services" aria-label="მომსახურება">{c.offers.slice(0, 3).map((offer, index) => <li key={`${offer}-${index}`}>{offer}</li>)}{c.offers.length > 3 ? <li className="company-card__more">+{c.offers.length - 3}</li> : null}</ul> : null}
      <div className="company-card__footer">
        {places ? <span className="company-card__places"><Icon name="map-pin" />{places}</span> : <span />}
        {c.phone ? <CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /> : null}
      </div>
    </article>
  );
}
