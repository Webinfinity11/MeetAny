import { BusinessMarks } from "./CompanyBusiness";
import type { BusinessFeature } from "../../lib/business-client";
import { SaveCompanyButton } from "./SaveCompanyButton";
import Link from "next/link";
import { companyImage } from "./CompanyAvatar";
import type { CSSProperties } from "react";
import { CallButton } from "./CallButton";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";

export type CompanyListingData = {
  id: string;
  feature?: BusinessFeature;
  name: string;
  logoUrl?: string | null;
  gallery?: string[];
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

/** Photo-first company card (same language as the home page): picture on top with the save button,
 *  then name, industry and cities, a few services and the call button. The whole card links to the profile. */
export function CompanyListingCard({ c, entranceIndex }: { c: CompanyListingData; entranceIndex?: number }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  const cityIds = [...new Set((c.serviceCities.filter(Boolean).length ? c.serviceCities : [c.city]).filter(Boolean))];
  const places = cityIds.slice(0, 2).map(id => cities[id] || id).join(", ") + (cityIds.length > 2 ? ` +${cityIds.length - 2}` : "");
  const image = companyImage(c.name, c.logoUrl, c.gallery);
  const entrance = entranceIndex != null && entranceIndex < 12;
  return (
    <article className="company-card" data-enter={entrance ? "" : undefined} style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined}>
      <Link className="company-card__media" href={href} tabIndex={-1} aria-hidden="true">
        {image ? <img src={image} alt="" loading="lazy" width={480} height={360} /> : <span className="company-card__initials"><Icon name="building-2" /></span>}
      </Link>
      {c.feature?.plan ? <span className="company-card__plan" data-plan={c.feature.plan}>{c.feature.plan === "vip" ? "VIP" : "Premium"}<span className="ma-sr-only"> — ფასიანი განთავსება</span></span> : null}
      <div className="company-card__save"><SaveCompanyButton id={c.id} icon /></div>
      <div className="company-card__body">
        <h3 className="company-card__name"><Link className="card-main-link" href={href}>{c.name}</Link></h3>
        <BusinessMarks feature={c.feature} hidePlan/>
        {c.about.startsWith("სადემო კომპანია.")?<span className="company-demo-label">სადემო კომპანია</span>:null}
        <p className="company-card__industry">{categories[c.industry] || c.industry}</p>
        {places ? <p className="company-card__places"><Icon name="map-pin" />{places}</p> : null}
        {c.offers.length ? <ul className="company-card__services" aria-label="მომსახურება">{c.offers.slice(0, 1).map((offer, index) => <li key={`${offer}-${index}`}>{offer}</li>)}{c.offers.length > 1 ? <li className="company-card__more">+{c.offers.length - 1}</li> : null}</ul> : null}
      </div>
      {c.phone ? <div className="company-card__footer"><CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /></div> : null}
    </article>
  );
}
