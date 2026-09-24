import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { CompanyAvatar } from "./CompanyAvatar";
import type { CSSProperties } from "react";
import { CallButton } from "./CallButton";
import { Icon } from "../Icon";
import { categories, cities } from "../../lib/categories";

export type CompanyListingData = {
  id: string;
  name: string;
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
  const places = cityIds.slice(0, 2).map(id => cities[id] || id).join(", ") + (cityIds.length > 2 ? ` +${cityIds.length - 2}` : "");
  return (
    <article className="company-listing supplier-row" data-enter={entranceIndex != null && entranceIndex < 12 ? "" : undefined} style={entranceIndex != null && entranceIndex < 12 ? { "--i": entranceIndex } as CSSProperties : undefined}>
      <CompanyAvatar name={c.name} size="lg" />
      <div className="listing-identity">
        <h3><Link className="card-main-link" href={href}>{c.name}</Link></h3>
        <p className="listing-location">{[categories[c.industry] || c.industry, places].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="listing-utilities"><SaveCompanyButton id={c.id} /></div>
      {c.offers.length ? <p className="listing-products">{c.offers.join(" · ")}</p> : null}
      {c.phone || c.directions ? <div className="supplier-contact">
        {c.phone ? <CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /> : null}
        {c.directions ? <a className="listing-directions" href={c.directions} target="_blank" rel="noopener noreferrer" aria-label={`${c.name} — მიმართულება Google Maps-ზე`}><Icon name="arrow-up-right" />მიმართულება</a> : null}
      </div> : null}
    </article>
  );
}
