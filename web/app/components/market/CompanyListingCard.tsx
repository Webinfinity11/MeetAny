import Link from "next/link";
import { Icon } from "../Icon";
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
    <article className="company-listing">
      <Link className="listing-media" href={href} aria-label={`${c.name} — კომპანიის პროფილი`}>
        <img src={`/assets/photos/${photo}`} alt="" width={800} height={533} loading="lazy" decoding="async" />
      </Link>
      <div className="listing-content">
        <div className="listing-summary">
          <div className="listing-heading">
            <div>
              <p className="listing-industry">{categories[c.industry] || c.industry}</p>
              <h3>
                <Link href={href}>{c.name}</Link>
              </h3>
            </div>
            <span className="listing-city">
              <Icon name="map-pin" />
              {cities[c.city] || c.city}
            </span>
          </div>
          </div>
        <p className="listing-description">{c.about || "კომპანიას აღწერა ჯერ არ დაუმატებია."}</p>
        {c.offers.length ? (
          <div className="listing-chips">
            <TagList items={c.offers} limit={3} />
          </div>
        ) : null}
        <dl className="listing-facts">
          <div>
            <dt>
              <Icon name="globe" />
              <span className="sr-only">მომსახურების არეალი</span>
            </dt>
            <dd>{c.serviceCities.length ? c.serviceCities.map((id) => cities[id] || id).join(" · ") : "ქალაქები არ არის მითითებული"}</dd>
          </div>
        </dl>
        <div className="listing-footer">
          {c.phone ? <CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /> : null}
          <Link className="ma-btn ma-btn--primary listing-profile-link" href={href} aria-label={`${c.name} — გაცნობა`}>
            პროფილის ნახვა <Icon name="arrow-right" />
          </Link>
        </div>
      </div>
    </article>
  );
}
