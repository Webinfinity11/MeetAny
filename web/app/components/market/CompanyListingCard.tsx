import styles from "./catalog/Catalog.module.css";
import { optimizable } from "../../lib/image";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { BusinessMarks } from "./CompanyBusiness";
import type { BusinessFeature } from "../../lib/business-client";
import { SaveCompanyButton } from "./SaveCompanyButton";
import Image from "next/image";
import Link from "next/link";
import { companyImage } from "./CompanyAvatar";
import type { CSSProperties } from "react";
import { CallButton } from "./CallButton";
import { categories, cities } from "../../lib/categories";
import { Icon } from "../Icon";
import { avatarInitials } from "../../lib/avatar-initials";

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

/** Catalog cards keep identity together, then give the description the full width. */
export function CompanyListingCard({ c, entranceIndex, catalog = false, catalogLayout = "grid" }: { c: CompanyListingData; entranceIndex?: number; catalog?: boolean; catalogLayout?: "grid" | "list" }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  const cityIds = [...new Set((c.serviceCities.filter(Boolean).length ? c.serviceCities : [c.city]).filter(Boolean))];
  const places = cityIds.slice(0, 2).map(id => cities[id] || id).join(", ") + (cityIds.length > 2 ? ` +${cityIds.length - 2}` : "");
  const image = companyImage(c.name, c.logoUrl, c.gallery);
  const isLogo = !!c.logoUrl && !c.gallery?.[0];
  const isDemo = c.about.startsWith("სადემო კომპანია.");
  const description = isDemo ? c.about.replace(/^სადემო კომპანია\. ინფორმაცია და ფოტოები საილუსტრაციოა\.\s*/, "") : c.about;
  const entrance = entranceIndex != null && entranceIndex < 12;
  if (catalog) return <article className={`${styles.company}${catalogLayout === "list" ? ` ${styles.companyRow}` : ""}`}>
    <header className={styles.companyIdentity}>
      {image ? <Image unoptimized={!optimizable(image)} className={`${styles.logo}${isLogo ? ` ${styles.containedLogo}` : ""}`} src={image} alt="" width={56} height={56} loading="lazy" /> : <Avatar name={c.name} size={56} className={styles.logo} />}
      <div className={styles.companyDetails}>
        <h3><Link href={href}>{c.name}</Link>{c.verified && <span aria-label="ვერიფიცირებული"><Icon name="badge-check" /></span>}</h3>
        <p>{categories[c.industry] || c.industry}{c.city ? ` · ${cities[c.city] || c.city}` : ""}</p>
        {isDemo ? <Badge className={styles.demoLabel}>სადემო კომპანია</Badge> : null}
      </div>
    </header>
    <div className={styles.companySummary}>
      {description && <p className={styles.description}>{description}</p>}
      {c.offers.length > 0 && <ul className={styles.services} aria-label="მომსახურება">{c.offers.slice(0, 2).map((offer, index) => <li key={index}>{offer}</li>)}{c.offers.length > 2 && <li>+{c.offers.length - 2}</li>}</ul>}
    </div>
    <div className={styles.companyActions}><Button variant="secondary" href={href}>პროფილის ნახვა</Button><SaveCompanyButton id={c.id}/></div>
  </article>;
  return (
    <article className={`company-card${catalog ? " company-card--catalog" : ""}`} data-enter={entrance ? "" : undefined} style={entrance ? { "--i": entranceIndex } as CSSProperties : undefined}>
      <Link className={`company-card__media${isLogo ? ` ${styles.logoMedia}` : ""}`} href={href} tabIndex={-1} aria-hidden="true">
        {image ? <Image src={image} alt="" loading="lazy" width={480} height={360} sizes="(max-width: 720px) 100vw, 480px" unoptimized={!optimizable(image)} /> : <span className="company-card__initials">{catalog ? avatarInitials(c.name) : <Icon name="building-2" />}</span>}
      </Link>
      {c.feature?.plan && catalog ? <Badge className="company-card__plan" status={c.feature.plan === "vip" ? "dark" : "neutral"}>{c.feature.plan === "vip" ? "VIP" : "Premium"}</Badge> : c.feature?.plan ? <span className="company-card__plan" data-plan={c.feature.plan}>{c.feature.plan === "vip" ? "VIP" : "Premium"}</span> : null}
      <div className="company-card__save"><SaveCompanyButton id={c.id} icon /></div>
      <div className="company-card__body">
        <h3 className="company-card__name"><Link className="card-main-link" href={href}>{c.name}</Link></h3>
        <BusinessMarks feature={c.feature} hidePlan/>
        {c.about.startsWith("სადემო კომპანია.")?<span className="company-demo-label">სადემო კომპანია</span>:null}
        <p className="company-card__industry">{categories[c.industry] || c.industry}{catalog && places ? ` · ${places}` : ""}</p>
        {catalog && c.about ? <p className="company-card__description">{c.about}</p> : null}
        {!catalog && places ? <p className="company-card__places"><Icon name="map-pin" />{places}</p> : null}
        {c.offers.length ? <ul className="company-card__services" aria-label="მომსახურება">{c.offers.slice(0, catalog ? 2 : 1).map((offer, index) => <li key={`${offer}-${index}`}>{offer}</li>)}{c.offers.length > (catalog ? 2 : 1) ? <li className="company-card__more">+{c.offers.length - (catalog ? 2 : 1)}</li> : null}</ul> : null}
      </div>
      {catalog || c.phone ? <div className={`company-card__footer${catalog ? " catalog-card-actions" : ""}`}>{catalog ? <Button variant="secondary" href={href}>პროფილის ნახვა</Button> : null}{c.phone ? <CallButton phone={c.phone} variant="secondary" contactId={c.id} source="company-list" /> : null}</div> : null}
    </article>
  );
}
