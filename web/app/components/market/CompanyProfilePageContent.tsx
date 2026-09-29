"use client";

import { ProfileSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { CompanyAvatar } from "./CompanyAvatar";
import { SaveCompanyButton } from "./SaveCompanyButton";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { sinceMonthLabel } from "../../lib/format";
import { usePublicPhone } from "../../lib/phones";
import { useCompanyDetail } from "../../lib/use-company-detail";

export function CompanyProfilePageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useCompanyDetail(store, ready, available, id);

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
  const phone = usePublicPhone(store, data?.c.id);

  if (ready && (!available || detail.error)) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready || (!data && detail.loading)) return <ProfileSkeleton />;
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
  const ownProfile = store?.currentUser()?.id === c.id;
  const name = c.company || c.name;
  // Current offers are strings; structured products can be rendered once the public contract supplies them.
  const products: ProductCardData[] = (c.offers || []).map((offer: string | ProductCardData) => typeof offer === "string" ? { name: offer } : offer);
  const pictured = products.filter(product => product.photoUrl);
  const plain = products.filter(product => !product.photoUrl);
  const directions: string | null = store?.directionsUrl(c) ?? null;

  const firstSentence = (c.about || "").trim().split(/(?<=[.!?])\s/)[0];
  const introduction = firstSentence.length > 140
    ? `${firstSentence.slice(0, 140).replace(/\s+\S*$/, "")}…`
    : firstSentence;
  const requestHref = (title: string) => `/requests/new/?${new URLSearchParams({ title, category: c.industry, city: c.city })}`;
  const requestLink = (title: string) => !ownProfile ? <Link className="ma-link company-service-request" href={requestHref(title)}>გამოაქვეყნე მოთხოვნა ამ მიმართულებით</Link> : null;

  const since = sinceMonthLabel(c.createdAt);
  const activity = [since && `საიტზე ${since}`, stats.sent > 0 && `${stats.sent} გაგზავნილი შეთავაზება`, stats.chosen > 0 && `${stats.chosen} არჩეული შეთავაზება`].filter(Boolean).join(" · ");

  return (
    <div className="ma-page company-profile detail-page">
      <div className="company-profile-tools"><Link className="ma-back" href="/companies/"><Icon name="arrow-left" />კომპანიების კატალოგი</Link>{!ownProfile ? <SaveCompanyButton id={c.id} /> : null}</div>
      <header className="company-identity-hero">
        <div className="company-identity-content"><CompanyAvatar name={name} logoUrl={c.logoUrl} size="xl" /><div><p className="company-identity-industry">{categories[c.industry] || c.industry}</p><h1>{name}</h1><p className="company-identity-city"><Icon name="map-pin" />{cities[c.city] || c.city}</p>{introduction ? <p className="company-identity-summary">{introduction}</p> : null}</div></div>
      </header>
      <nav className="company-section-nav" aria-label="კომპანიის პროფილის სექციები"><a href="#company-about">კომპანიის შესახებ</a><a href="#offers">შეთავაზებები {products.length}</a>{openRequests.length ? <a href="#company-requests">ღია მოთხოვნები {openRequests.length}</a> : null}</nav>
      <div className="company-profile-layout">
      <aside className="company-contact-card" aria-labelledby="company-contact-heading">
        <h2 id="company-contact-heading" className="ma-h3">კონტაქტი</h2>
        <p>{ownProfile ? "ეს შენი კომპანიის საჯარო გვერდია. ინფორმაცია შეგიძლია ანგარიშიდან განაახლო." : "დაუკავშირდი კომპანიას პირობების დასაზუსტებლად."}</p>
        <div className="company-contact-actions">{ownProfile ? <Link className="ma-btn ma-btn--primary" href="/account/?tab=profile">პროფილის რედაქტირება</Link> : <>{phone ? <CallButton phone={phone} contactId={c.id} source="company-profile" /> : null}<MessageButton companyId={c.id}/></>}</div>
        <div className="company-profile-coverage"><span>მომსახურების არეალი</span><p>{(c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ") || "არ არის მითითებული"}</p></div>
        {c.address || directions ? <div className="company-contact-address"><span>მისამართი</span>{c.address ? <p>{c.address}</p> : null}{directions ? <a href={directions} target="_blank" rel="noopener noreferrer"><Icon name="map-pin" />რუკაზე ნახვა</a> : null}</div> : null}
      </aside>
      <div className="company-profile-main">
        <section aria-labelledby="company-about">
          <h2 id="company-about" className="ma-h3">კომპანიის შესახებ</h2>
          <p className="company-profile-description">{c.about || "კომპანიას აღწერა ჯერ არ დაუმატებია."}</p>
          {c.seeks?.length ? <div className="company-profile-seeks"><h3>რას ეძებს კომპანია</h3><p>{c.seeks.join(", ")}</p></div> : null}
        </section>
        <section id="offers" aria-labelledby="company-services">
          <h2 id="company-services" className="ma-h3">პროდუქტები და მომსახურება</h2>
          {pictured.length ? <div className="company-product-grid">{pictured.map((product, index) => <div key={`${product.name}-${index}`}><ProductCard {...product} />{requestLink(product.name)}</div>)}</div> : null}
          {plain.length ? <ul className="company-profile-services">{plain.map((product, index) => <li key={`${product.name}-${index}`}><span>{product.name}</span>{requestLink(product.name)}</li>)}</ul> : null}
          {!products.length ? <p className="detail-empty">ჯერ არ არის მითითებული.</p> : null}
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

      </div>

      {activity ? <p className="company-profile-activity">{activity}</p> : null}
    </div>
  );
}
