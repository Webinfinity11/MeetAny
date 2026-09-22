import Link from "next/link";
import { Icon } from "./Icon";
import type { FeaturedCompany } from "../lib/home-data";

export function CompanyCard({ company }: { company: FeaturedCompany }) {
  const href = "/companies/";
  return (
    <article className="company-listing">
      <Link className="listing-media" href={href} aria-label={`${company.name} — კომპანიის პროფილი`}>
        <img
          src={`/assets/photos/${company.photo}`}
          alt={company.photoAlt}
          width={800}
          height={533}
          loading="lazy"
          decoding="async"
        />
      </Link>
      <div className="listing-content">
        <div className="listing-heading">
          <span className="company-logo company-photo-avatar">
            <img
              src={`/assets/photos/${company.photo}`}
              alt={`${company.name} — სამუშაო გარემოს ფოტო`}
              loading="lazy"
              decoding="async"
            />
          </span>
          <div>
            <p className="listing-industry">{company.industryLabel}</p>
            <h3>
              <Link href={href}>{company.name}</Link>
            </h3>
          </div>
          <span className="listing-city">
            <Icon name="map-pin" />
            {company.cityLabel}
          </span>
        </div>
        <p className="listing-description">{company.description}</p>
        <dl className="listing-facts">
          <div>
            <dt>
              <Icon name="globe" />
              <span className="sr-only">მომსახურების არეალი</span>
            </dt>
            <dd>{company.area}</dd>
          </div>
          <div>
            <dt>
              <Icon name="handshake" />
              <span className="sr-only">თანამშრომლობა</span>
            </dt>
            <dd>{company.collaborationLabels.join(" · ")}</dd>
          </div>
        </dl>
        <div className="listing-footer">
          <Link className="listing-offers" href={`${href}#offers`}>
            {company.offerCount} შეთავაზება <Icon name="chevron-right" />
          </Link>
          <Link className="button listing-action" href={href} aria-label={`${company.name} — გაცნობა`}>
            კომპანიის ნახვა <Icon name="arrow-up-right" />
          </Link>
        </div>
      </div>
    </article>
  );
}
