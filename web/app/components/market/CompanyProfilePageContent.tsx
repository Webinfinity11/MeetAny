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
import { CompanyActions } from "./company/CompanyActions";
import { CompanyReviews } from "./company/CompanyReviews";
import styles from "./company/CompanyProfile.module.css";

import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";


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


  const gallery: string[] = c.gallery || [];
  const photos = [...gallery, ...pictured.map(p => p.photoUrl)]
    .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  // A public timestamp must produce the same year in SSR and browser time zones.
  const year = new Date(c.createdAt).getUTCFullYear();
  const facts = [
    ["მომსახურების ქალაქები", (c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ")],
    ["მისამართი", c.address],
    ["რას ეძებს", (c.seeks || []).join(" · ")],
  ].filter(([, value]) => value);

  return (
    <div className={`ma-page company-profile detail-page ${styles.page}`}>
      <Link className="ma-back" href="/companies/"><Icon name="chevron-left" />კომპანიები</Link>
      <header className={styles.hero}>
        <span className={styles.avatar}>{c.logoUrl ? <img src={c.logoUrl} alt="" /> : avatarInitials(name)}</span>
        <div className={styles.identity}>
          <h1 className={styles.name}>{name}{c.verified ? <span className={styles.verified} aria-label="ვერიფიცირებული კომპანია" title="ვერიფიცირებული კომპანია"><Icon name="badge-check" /></span> : null}</h1>
          <p className="company-hero__industry">{[categories[c.industry] || c.industry, cities[c.city] || c.city, Number.isFinite(year) ? `საიტზე ${year} წლიდან` : null].filter(Boolean).join(" · ")}</p>
          {c.about?.startsWith("სადემო კომპანია.") ? <p className="company-demo-label">სადემო კომპანია · ინფორმაცია და კონტაქტები პრეზენტაციის მაგალითია.</p> : null}
        </div>
        <div className={styles.actions}>
          {ownProfile ? <Button variant="primary" href="/account/?tab=profile">რედაქტირება</Button> : <><CompanyActions companyId={c.id} name={name}/><SaveCompanyButton id={c.id}/></>}
        </div>
        <p className={styles.contactRule}><Icon name="lock-keyhole"/>ტელეფონი და ელფოსტა იხსნება მხოლოდ შეთავაზების არჩევის შემდეგ</p>
      </header>
      <div className={styles.content}>
      {facts.length ? <section className={styles.panel} aria-label="კომპანიის დეტალები"><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
      <div className={styles.main}>
        {c.about ? <section aria-labelledby="company-about">
          <h2 id="company-about" className="detail-section-title">ჩვენ შესახებ</h2>
          <p className="company-profile-description">{c.about}</p>
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
        <CompanyReviews companyId={c.id}/>
        {!ownProfile && store?.currentUser()?.role !== "admin" ? <ReportButton kind="company" targetId={c.id} /> : null}
      </div>

      </div>
      <SimilarCompanies store={store as never} current={c} features={business.data} />
    </div>
  );
}
