import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { TagList } from "./TagList";
import { CallButton } from "./CallButton";
import { categories, categoryPhoto, cities } from "../../lib/categories";

export type CompanyListingData = {
  id: string;
  name: string;
  industry: string;
  city: string;
  serviceCities: string[];
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
        <p className="listing-industry listing-location" title={[categories[c.industry] || c.industry, ...(c.serviceCities.length ? c.serviceCities : [c.city]).map(id => cities[id] || id)].join(" · ")}>{categories[c.industry] || c.industry} · {(c.serviceCities.length ? c.serviceCities : [c.city]).map(id => cities[id] || id).join(" · ")}</p>
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
