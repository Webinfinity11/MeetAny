"use client";
import { optimizable } from "../../lib/image";
import Image from "next/image";
import { Button } from "../ui/Button";


import { ProfileSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyProducts } from "./CompanyProducts";
import { type ProductCardData } from "./ProductCard";
import { CompanyGallery } from "./CompanyGallery";
import { CompanyActions } from "./company/CompanyActions";
import { CompanyReviews, useCompanyReviews, useCompanyStats } from "./company/CompanyReviews";
import styles from "./company/CompanyProfile.module.css";

import { SaveCompanyButton } from "./SaveCompanyButton";
import { Notice } from "../ui/Notice";
import { isInternalTestAccount } from "../../lib/catalog-visibility";
import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";


import { useCompanyDetail } from "../../lib/use-company-detail";
import { isUuid } from "../../lib/ids";
import { EmptyState } from "../ui/Structure";
import { companyImage } from "./CompanyAvatar";
export function CompanyProfilePageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const validId = isUuid(id);
  const detail = useCompanyDetail(store, sessionReady, available, id);
  // A malformed id never reaches the API (it would only answer 400).
  const reviews = useCompanyReviews(validId ? id : "");
  const stats = useCompanyStats(validId ? id : "");

  const data = useMemo(() => {
    if (!store || !ready || !available || !id) return null;
    const c = store.getCompany(id);
    if (!c) return null;
    const openRequests = (store.listRequests({ ownerId: id, state: "open" }) as { id: string; title: string; quantity: number | null; unit: string | null; city: string }[]).map(
      (r) => ({ id: r.id, title: r.title, city: cities[r.city] || r.city }),
    );
    return { c, openRequests };
  }, [store, ready, available, id]);


  const notFound = !validId || (ready && available && !detail.error && sessionReady && !detail.loading && !data);
  const pageName = data ? data.c.company || data.c.name : "";
  const pageTitle = pageName ? `${pageName} — MeetAny` : notFound ? "კომპანია ვერ მოიძებნა — MeetAny" : "";
  useEffect(() => { if (pageTitle) document.title = pageTitle; }, [pageTitle]);

  if (notFound) {
    return (
      <div className="ma-page">
        <EmptyState icon="search" title="კომპანია ვერ მოიძებნა" text="შესაძლოა პროფილი წაიშალა ან დროებით დამალულია." action={<Button variant="secondary" href="/companies/">ყველა კომპანია</Button>} />
      </div>
    );
  }
  if (ready && (!available || detail.error)) return <div className="ma-page"><ServiceUnavailable /></div>;

  if (!ready || !data) return <ProfileSkeleton />;

  const { c, openRequests } = data;
  const ownProfile = store?.currentUser()?.id === c.id;
  const name = c.company || c.name;
  // Current offers are strings; structured products can be rendered once the public contract supplies them.
  const products: ProductCardData[] = (c.offers || []).map((offer: string | ProductCardData) => typeof offer === "string" ? { name: offer } : offer);
  // Same picture as the company's catalog card, so the profile never shows an empty logo box when the card has one.
  const logo = companyImage(name, c.logoUrl, c.gallery);
  // The demo notice is shown once, as the label under the name; the description starts with the company itself.
  const about = String(c.about || "").replace(/^სადემო კომპანია\. ინფორმაცია და ფოტოები საილუსტრაციოა\.\s*/, "");
  const pictured = products.filter(product => product.photoUrl);


  const gallery: string[] = c.gallery || [];
  const photos = [...gallery, ...pictured.map(p => p.photoUrl)]
    .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  const facts = [
    ["მომსახურების ქალაქები", (c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ")],
    ["მისამართი", c.address],
    ["ყიდულობს", (c.seeks || []).join(" · ")],
  ].filter(([, value]) => value);

  // Reporting is the quiet last line of the details panel (or of the page when there is no panel).
  const report = !ownProfile && store?.currentUser()?.role !== "admin" ? <ReportButton kind="company" targetId={c.id} /> : null;
  return (
    <div className={`ma-page company-profile detail-page ${styles.page}`}>
      <Link className="ma-back" href="/companies/"><Icon name="chevron-left" />კომპანიები</Link>
      {ownProfile && (!c.verified || c.blocked || isInternalTestAccount(c)) ? <Notice>ეს გვერდი სტუმრისთვის არ ჩანს — მიზეზი: {!c.verified ? "ვერიფიკაცია არ არის" : "დამალულია"}.</Notice> : null}
      <header className={styles.hero}>
        <span className={styles.avatar}>{logo ? <Image src={logo} alt="" width={160} height={160} sizes="64px" priority unoptimized={!optimizable(logo)} /> : <Icon name="building-2"/>}
          {c.verified ? <span className={styles.verified} role="img" aria-label="ვერიფიცირებული კომპანია"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 14.4 4l3.1-.3.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.3L12 22l-2.4-2-3.1.3-.9-3L2.9 15.7l1-3-1-3 2.7-1.6.9-3 3.1.3L12 2Z"/><path className={styles.verifiedCheck} d="m8.5 12.2 2.3 2.3 4.7-4.9"/></svg></span> : null}
        </span>
        <div className={styles.identity}>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>{[categories[c.industry] || c.industry, cities[c.city] || c.city].filter(Boolean).join(" · ")}</p>
          {reviews.data && reviews.data.total > 0 ? <p className={styles.rating}><Icon name="star" className={styles.filledStar}/><strong>{reviews.data.rating ?? "—"}</strong><span>· {reviews.data.total} შეფასება</span></p> : null}
          {stats.error ? null : stats.data ? <p className={styles.dealStats}><Icon name="handshake"/><strong>{stats.data.completedDeals}</strong><span>დასრულებული გარიგება</span></p> : <span className={styles.dealStatsSkeleton} aria-hidden="true"/>}
          {c.about?.startsWith("სადემო კომპანია.") ? <p className="company-demo-label">სადემო კომპანია · ინფორმაცია და კონტაქტები პრეზენტაციის მაგალითია.</p> : null}
        </div>
        <div className={styles.actions}>
          {ownProfile ? <Button variant="primary" href="/account/?tab=profile">რედაქტირება</Button> : <><Button variant="primary" href={`/requests/new/?category=${encodeURIComponent(c.industry || "")}&company=${encodeURIComponent(c.id)}`}><Icon name="file-text"/>ფასის მოთხოვნა</Button><CompanyActions companyId={c.id} name={name}/><SaveCompanyButton id={c.id}/><p>მოთხოვნა საჯაროა — {name} და სხვა კომპანიებიც ნახავენ.</p></>}
        </div>
      </header>
      <div className={`${styles.content} ${facts.length ? "" : styles.contentFull}`}>
      <div className={styles.main}>
        {about || products.length ? <section aria-labelledby="company-about">
          <h2 id="company-about" className="detail-section-title">კომპანიის შესახებ</h2>
          {about ? <p className="company-profile-description">{about}</p> : null}
          <div className={styles.chips}>{products.map((product, i) => <span key={`${i}:${product.name}`}>{product.name}</span>)}</div>
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
        <CompanyReviews resource={reviews}/>
      </div>

      {facts.length ? <aside className={styles.sidebar}><section className={styles.panel}><h2 className="detail-section-title">დეტალები</h2><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{report ? <div className={styles.report}>{report}</div> : null}</section></aside> : null}
      </div>
      {!facts.length && report ? <div className={styles.report}>{report}</div> : null}
    </div>
  );
}
