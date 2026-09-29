import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { CompanyAvatar } from "./CompanyAvatar";
import type { CSSProperties } from "react";
import { CallButton } from "./CallButton";
import { categories, cities, categoryPhoto } from "../../lib/categories";

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
  const places = cityIds.slice(0, 2).map(id => cities[id] || id).join(", ") + (cityIds.length > 2 ? ` +${cityIds.length - 2}` : "");
  return (
    <article className="company-listing supplier-row" data-enter={entranceIndex != null && entranceIndex < 12 ? "" : undefined} style={entranceIndex != null && entranceIndex < 12 ? { "--i": entranceIndex } as CSSProperties : undefined}>
      <Link className="supplier-photo" href={href} tabIndex={-1} aria-hidden="true"><img src={`/assets/photos/${categoryPhoto[c.industry] || categoryPhoto.other}`} alt="" width={640} height={420} loading="lazy" /><span>{categories[c.industry] || c.industry}</span></Link>
      <div className="supplier-heading"><CompanyAvatar name={c.name} logoUrl={c.logoUrl} size="lg" />
        <div className="listing-identity"><h3><Link className="card-main-link" href={href}>{c.name}</Link></h3><p className="listing-location">{places || "ქალაქი არ არის მითითებული"}</p></div>
        <div className="listing-utilities"><SaveCompanyButton id={c.id} /></div>
      </div>
      {c.about ? <p className="supplier-description">{c.about}</p> : null}
      {c.offers.length ? <div className="supplier-services">{c.offers.slice(0,3).map((offer,index) => <span key={`${offer}-${index}`}>{offer}</span>)}{c.offers.length > 3 ? <span>+{c.offers.length - 3}</span> : null}</div> : null}
      <div className="supplier-footer"><Link className="ma-btn ma-btn--secondary" href={href}>პროფილის ნახვა</Link>{c.phone ? <CallButton phone={c.phone} contactId={c.id} source="company-list" /> : null}</div>
    </article>
  );
}
