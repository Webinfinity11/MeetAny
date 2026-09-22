import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { TagList } from "./TagList";
import { categories, cities } from "../../lib/categories";

export type CompanyRowData = {
  id: string;
  name: string;
  industry: string;
  city: string;
  serviceCities: string[];
  offers: string[];
  verified: boolean;
  stats: { sent: number; chosen: number };
};

export function statsLabel(stats: { sent: number; chosen: number }): string {
  return stats.sent ? `${stats.sent} გაგზავნილი · ${stats.chosen} არჩეული` : "ახალი წევრი";
}

export function CompanyRow({ c }: { c: CompanyRowData }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  return (
    <article className="r2-company-row">
      <CompanyAvatar name={c.name} />
      <div className="r2-company-body">
        <Link className="ma-title ma-proto-rowtitle" href={href}>
          {c.name}
        </Link>
        {c.verified ? (
          <span className="ma-badge ma-badge--success">
            <Icon name="check" />
            დადასტურებული
          </span>
        ) : null}
        <p className="ma-small ma-muted">
          {categories[c.industry] || c.industry} · {cities[c.city] || c.city}
        </p>
        <p className="ma-small">ემსახურება: {c.serviceCities.length ? c.serviceCities.join(", ") : "ქალაქები არ არის მითითებული"}</p>
        <p className="ma-small">რას გთავაზობთ</p>
        <TagList items={c.offers} limit={3} />
      </div>
      <div className="r2-company-end">
        <span>{statsLabel(c.stats)}</span>
        <Link className="ma-btn ma-btn--secondary" href={href}>
          პროფილი <Icon name="arrow-right" />
        </Link>
      </div>
    </article>
  );
}
