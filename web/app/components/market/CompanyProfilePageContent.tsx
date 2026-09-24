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
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { sinceMonthLabel } from "../../lib/format";
import { usePublicPhone } from "../../lib/phones";

export function CompanyProfilePageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
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

  // The snapshot/store already carries the public phone; the separate fetch is only a fallback.
  const snapshotPhone: string | null = data?.c.phone || null;
  const fetchedPhone = usePublicPhone(data && !snapshotPhone ? data.c.id : undefined);
  const phone = snapshotPhone || fetchedPhone;

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
  const directions: string | null = store?.directionsUrl(c) ?? null;

  const since = sinceMonthLabel(c.createdAt);
  const activity = [since && `საიტზე ${since}`, stats.sent > 0 && `${stats.sent} გაგზავნილი შეთავაზება`, stats.chosen > 0 && `${stats.chosen} არჩეული შეთავაზება`].filter(Boolean).join(" · ");

  return (
    <div className="ma-page company-profile detail-page">
      <div className="company-profile-tools"><Link className="ma-back" href="/companies/"><Icon name="arrow-left" />კომპანიები</Link></div>
      <PageBand
        title={name}
        avatar={<CompanyAvatar name={name} size="lg" />}
        meta={<span className="detail-meta">{[categories[c.industry] || c.industry, cities[c.city] || c.city, c.address].filter(Boolean).join(" · ")}{directions ? <a className="ma-link company-profile-directions" href={directions} target="_blank" rel="noopener noreferrer"><Icon name="arrow-up-right" />მიმართულება</a> : null}</span>}
        actions={<>{phone ? <CallButton phone={phone} contactId={c.id} source="company-profile" /> : null}<MessageButton companyId={c.id}/><SaveCompanyButton id={c.id} icon /></>}
      />
      <div className="company-profile-coverage">
        <span>მომსახურების არეალი</span>
        <p>{(c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ") || "არ არის მითითებული"}</p>
      </div>

      {/* One reading column: what the company seeks follows its description, not a side panel. */}
      <div className="company-profile-main">
        <section aria-labelledby="company-about">
          <h2 id="company-about" className="ma-h3">კომპანიის შესახებ</h2>
          <p className="company-profile-description">{c.about || "კომპანიას აღწერა ჯერ არ დაუმატებია."}</p>
          {c.seeks?.length ? <p className="company-profile-seeks">ეძებს: {c.seeks.join(", ")}</p> : null}
        </section>
        <section id="offers" aria-labelledby="company-services">
          <h2 id="company-services" className="ma-h3">პროდუქტები და მომსახურება</h2>
          {c.offers?.length ? <ul className="company-profile-services">{c.offers.map((offer: string) => <li key={offer}>{offer}</li>)}</ul> : <p className="detail-empty">ჯერ არ არის მითითებული.</p>}
        </section>
        {openRequests.length ? <section className="company-profile-requests" aria-labelledby="company-requests">
          <h2 id="company-requests" className="ma-h3">ღია მოთხოვნები</h2>
          <div className="company-profile-request-list">
            {openRequests.map((r) => <article key={r.id}>
              <h3><Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`}>{r.title}</Link></h3>
              <p>{r.city} · {r.offerCount} შეთავაზება</p>
            </article>)}
          </div>
        </section> : null}
      </div>

      {activity ? <p className="company-profile-activity">{activity}</p> : null}
    </div>
  );
}
