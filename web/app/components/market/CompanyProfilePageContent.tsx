"use client";
import { Button } from "../ui/Button";


import { ProfileSkeleton } from "./Skeletons";

import { useCompanyFeatures } from "../../lib/business-client";
import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyProducts } from "./CompanyProducts";
import { type ProductCardData } from "./ProductCard";
import { avatarInitials } from "./CompanyAvatar";
import { CompanyGallery } from "./CompanyGallery";
import { SimilarCompanies } from "./SimilarCompanies";
import { SaveCompanyButton } from "./SaveCompanyButton";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { sinceMonthLabel } from "../../lib/format";
import { usePublicPhone } from "../../lib/phones";
import { useCompanyDetail } from "../../lib/use-company-detail";
export function CompanyProfilePageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const business = useCompanyFeatures(store, ready && available);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useCompanyDetail(store, sessionReady, available, id);

  const data = useMemo(() => {
    if (!store || !ready || !available || !id) return null;
    const c = store.getCompany(id);
    if (!c) return null;
    const openRequests = (store.listRequests({ ownerId: id, state: "open" }) as { id: string; title: string; quantity: number | null; unit: string | null; city: string }[]).map(
      (r) => ({ id: r.id, title: r.title, city: cities[r.city] || r.city }),
    );
    return { c, openRequests };
  }, [store, ready, available, id]);

  // The snapshot/store already carries the public phone; the separate fetch is only a fallback.
  const phone = usePublicPhone(store, data?.c.id);

  if (ready && (!available || detail.error)) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready || (!data && (!sessionReady || detail.loading))) return <ProfileSkeleton />;
  if (!data) {
    return (
      <div className="ma-page">
        <div className="ma-empty">
          <h2 className="ma-empty__title">კომპანია ვერ მოიძებნა</h2>
          <Button variant="secondary" href="/companies/">
            კომპანიების კატალოგზე დაბრუნება
          </Button>
        </div>
      </div>
    );
  }

  const { c, openRequests } = data;
  const ownProfile = store?.currentUser()?.id === c.id;
  const name = c.company || c.name;
  // Current offers are strings; structured products can be rendered once the public contract supplies them.
  const products: ProductCardData[] = (c.offers || []).map((offer: string | ProductCardData) => typeof offer === "string" ? { name: offer } : offer);
  const pictured = products.filter(product => product.photoUrl);

  const requestHref = (title: string) => `/requests/new/?${new URLSearchParams({ title, category: c.industry, city: c.city })}`;
  const gallery: string[] = c.gallery || [];
  const photos = [...gallery, ...pictured.map(p => p.photoUrl)]
    .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  const since = sinceMonthLabel(c.createdAt);

  return (
    <div className="ma-page company-profile detail-page">
      <Link className="ma-back" href="/companies/"><Icon name="chevron-left" />კომპანიები</Link>
      <header className="company-hero">
        <span className="company-hero__thumb">{c.logoUrl ? <img src={c.logoUrl} alt="" /> : avatarInitials(name)}</span>
        <div className="company-hero__text">
          <h1 className="company-hero__name">{name}</h1>
          <p className="company-hero__industry">{[categories[c.industry] || c.industry, cities[c.city] || c.city, since ? `საიტზე ${since}` : null].filter(Boolean).join(" · ")}</p>
          {c.about?.startsWith("სადემო კომპანია.") ? <p className="company-demo-label">სადემო კომპანია · ინფორმაცია და კონტაქტები პრეზენტაციის მაგალითია.</p> : null}
        </div>
        <div className="company-hero__actions">
          {ownProfile ? <Button variant="primary" href="/account/?tab=profile">პროფილის რედაქტირება</Button> : <><Button variant="primary" href={requestHref("")}><Icon name="file-text"/>ფასის მოთხოვნა</Button><div className="company-hero__secondary">{phone ? <CallButton phone={phone} variant="secondary" contactId={c.id} source="company-profile"/> : null}<SaveCompanyButton id={c.id} icon/></div><MessageButton companyId={c.id}/></>}
        </div>
      </header>
      <div className={`company-profile-layout${c.address ? "" : " company-profile-layout--full"}`}>
      {c.address ? <aside className="company-contact-card" aria-labelledby="company-contact-heading"><h2 id="company-contact-heading" className="detail-section-title">დეტალები</h2><dl className="company-detail-facts"><div><dt>მისამართი</dt><dd>{c.address}</dd></div></dl></aside> : null}
      <div className="company-profile-main">
        {c.about || c.seeks?.length || c.serviceCities?.length ? <section aria-labelledby="company-about">
          <h2 id="company-about" className="detail-section-title">ჩვენ შესახებ</h2>
          {c.about ? <p className="company-profile-description">{c.about}</p> : null}
          {c.seeks?.length ? <div className="company-profile-seeks"><h3>რას ეძებს კომპანია</h3><div className="company-profile-chips">{c.seeks.map((item: string) => <span key={item}>{item}</span>)}</div></div> : null}
          {c.serviceCities?.length ? <div className="company-profile-coverage"><span>მომსახურების არეალი</span><div className="company-profile-chips">{c.serviceCities.map((id: string) => <span key={id}>{cities[id] || id}</span>)}</div></div> : null}
        </section> : null}
        <CompanyProducts companyId={c.id} fallback={products}/>
        {photos.length ? <section><h2 className="detail-section-title">გალერეა</h2><CompanyGallery photos={photos} name={name}/></section> : null}
        {openRequests.length ? <section className="company-profile-requests" aria-labelledby="company-requests">
          <h2 id="company-requests" className="detail-section-title">ღია მოთხოვნები</h2>
          <div className="company-profile-request-list">
            {openRequests.map((r) => <article key={r.id}>
              <h3><Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`}>{r.title}</Link></h3>
              <p>{r.city}</p>
            </article>)}
          </div>
        </section> : null}
        {!ownProfile && store?.currentUser()?.role !== "admin" ? <ReportButton kind="company" targetId={c.id} /> : null}
      </div>

      </div>
      <SimilarCompanies store={store as never} current={c} features={business.data} />
    </div>
  );
}
