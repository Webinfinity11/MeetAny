import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { TagList } from "./TagList";
import { CallButton } from "./CallButton";
import { Icon } from "../Icon";
import { categories, categoryPhoto, cities } from "../../lib/categories";

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

// Compact industry-photo listing with service chips and a public phone link.
export function CompanyListingCard({ c }: { c: CompanyListingData }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  const photo = categoryPhoto[c.industry] || categoryPhoto.other;
  const places = [categories[c.industry] || c.industry, ...(c.serviceCities.length ? c.serviceCities : [c.city]).map(id => cities[id] || id)].join(" · ");
  return (
    <article className="company-listing supplier-row">
      <Link className="listing-media" href={href} aria-label={`${c.name} — კომპანიის პროფილი`}>
        <img src={`/assets/photos/${photo}`} alt="" width={800} height={533} loading="lazy" decoding="async" />
      </Link>
      <div className="listing-content">
        <div className="listing-summary">
          <div className="listing-heading">
            <div>
              <h3>
                <Link className="card-main-link" href={href}>{c.name}</Link>
              </h3>
            </div>
            <div className="listing-utilities"><SaveCompanyButton id={c.id} /></div>
          </div>
          </div>
        <p className={c.directions ? "listing-industry listing-location listing-location--directions" : "listing-industry listing-location"} title={places}>
          {c.directions ? <span className="listing-location__text">{places}</span> : places}
          {c.directions ? <a className="listing-directions ma-small" href={c.directions} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`${c.name} — მიმართულება Google Maps-ზე`}><Icon name="arrow-up-right" />მიმართულება</a> : null}
        </p>
        {c.offers.length ? (
          <div className="listing-chips">
            <TagList items={c.offers} limit={3} />
          </div>
        ) : null}
        <div className="supplier-contact">
        <div className="listing-footer">
          {c.phone ? <CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /> : null}
          <Link className="ma-btn ma-btn--primary listing-profile-link" href={href} aria-label={`${c.name} — გაცნობა`}>
            პროფილი
          </Link>
        </div>
        </div>
      </div>
    </article>
  );
}
