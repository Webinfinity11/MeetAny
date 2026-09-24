"use client";

import { ProfileSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyAvatar } from "./CompanyAvatar";
import { PageBand } from "./PageBand";
import { SaveCompanyButton } from "./SaveCompanyButton";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { useMarketStore } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { dateLabel } from "../../lib/format";
import { usePublicPhone } from "../../lib/phones";

export function CompanyProfilePageContent() {
  const { store, ready, available } = useMarketStore();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const data = useMemo(() => {
    if (!store || !ready || !available || !id) return null;
    const c = store.getCompany(id);
    if (!c) return null;
    const stats = store.companyStats(id);
    const openRequests = (store.listRequests({ ownerId: id, state: "open" }) as { id: string; title: string; quantity: number | null; unit: string | null; city: string }[]).map(
      (r) => ({ id: r.id, title: r.title, city: cities[r.city] || r.city, offerCount: store.offerCount(r.id) }),
    );
    return { c, stats, openRequests };
  }, [store, ready, available, id]);

  const phone = usePublicPhone(data?.c.id);

  if (ready && !available) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready) return <ProfileSkeleton />;
  if (!data) {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <span className="ma-empty__icon">
            <Icon name="search" />
          </span>
          <h2 className="ma-empty__title">კომპანია ვერ მოიძებნა</h2>
          <Link className="ma-btn ma-btn--secondary" href="/companies/">
            კომპანიების კატალოგზე დაბრუნება
          </Link>
        </div>
      </div>
    );
  }

  const { c, stats, openRequests } = data;
  const name = c.company || c.name;
  const ctaHref = `/requests/new/?category=${encodeURIComponent(c.industry)}`;

  return (
    <div className="ma-page company-profile">
      <div className="company-profile-tools"><Link className="ma-back" href="/companies/"><Icon name="arrow-left" />კომპანიები</Link><SaveCompanyButton id={c.id} /></div>
      <PageBand
        eyebrow="MeetAny · კომპანია"
        title={name}
        description={categories[c.industry] || c.industry}
        avatar={<CompanyAvatar name={name} size="xl" />}
        meta={<span className="company-profile-city"><Icon name="map-pin" />{cities[c.city] || c.city}</span>}
        actions={<>{phone ? <CallButton phone={phone} contactId={c.id} source="company-profile" /> : null}<MessageButton companyId={c.id}/></>}
      />
      <div className="company-profile-coverage">
        <Icon name="globe" />
        <div><span>მომსახურების არეალი</span><p>{(c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ") || "არ არის მითითებული"}</p></div>
      </div>

      <div className="company-profile-body">
        <div className="company-profile-main">
          <section aria-labelledby="company-about">
            <h2 id="company-about" className="ma-h3">კომპანიის შესახებ</h2>
            <p className="company-profile-description">{c.about || "კომპანიას აღწერა ჯერ არ დაუმატებია."}</p>
          </section>
          <section id="offers" aria-labelledby="company-services">
            <h2 id="company-services" className="ma-h3">პროდუქტები და მომსახურება</h2>
            {c.offers?.length ? <ul className="company-profile-services">{c.offers.map((offer: string) => <li key={offer}>{offer}</li>)}</ul> : <p className="ma-muted">ჯერ არ არის მითითებული.</p>}
          </section>
        </div>
        <aside className="company-profile-partnership" aria-labelledby="company-partnership">
          <h2 id="company-partnership" className="ma-h3">თანამშრომლობის ინტერესები</h2>
          {c.seeks?.length ? <ul>{c.seeks.map((seek: string) => <li key={seek}>{seek}</li>)}</ul> : <p className="ma-muted">ჯერ არ არის მითითებული.</p>}
          {phone ? <CallButton phone={phone} variant="secondary" contactId={c.id} source="company-partnership" /> : null}
        </aside>
      </div>

      <section className="company-profile-requests" aria-labelledby="company-requests">
        <div className="company-profile-section-head">
          <h2 id="company-requests" className="ma-h3">ღია მოთხოვნები <span>{openRequests.length}</span></h2>
          <Link className="ma-link" href={ctaHref}>ამ დარგში მოთხოვნის დამატება <Icon name="plus" /></Link>
        </div>
        {openRequests.length ? <div className="company-profile-request-list">
          {openRequests.map((r) => <article key={r.id}>
            <Link className="ma-title ma-proto-rowtitle" href={`/requests/view/?id=${r.id}`}>{r.title}<Icon name="arrow-right" /></Link>
            <p className="ma-small ma-muted">{r.city} · {r.offerCount} შეთავაზება</p>
          </article>)}
        </div> : <p className="ma-muted">ამ კომპანიას ღია მოთხოვნა ჯერ არ აქვს.</p>}
      </section>
      <dl className="company-profile-activity">
        <div><dt>წევრია</dt><dd>{dateLabel(c.createdAt)}</dd></div>
        <div><dt>გაგზავნილი შეთავაზება</dt><dd>{stats.sent}</dd></div>
        <div><dt>არჩეული შეთავაზება</dt><dd>{stats.chosen}</dd></div>
      </dl>
    </div>
  );
}
