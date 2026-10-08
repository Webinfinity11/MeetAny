"use client";
import { Button } from "../ui/Button";


import { ProfileSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { CompanyProducts } from "./CompanyProducts";
import { type ProductCardData } from "./ProductCard";
import { avatarInitials } from "./CompanyAvatar";
import { CompanyGallery } from "./CompanyGallery";
import { CompanyActions } from "./company/CompanyActions";
import { CompanyReviews, useCompanyReviews } from "./company/CompanyReviews";
import styles from "./company/CompanyProfile.module.css";

import { ReportButton } from "./ReportButton";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";


import { useCompanyDetail } from "../../lib/use-company-detail";
export function CompanyProfilePageContent({ initial }: { initial?: PublicSnapshot }) {
  const { store, ready, sessionReady, available } = useMarketStore(initial);
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const detail = useCompanyDetail(store, sessionReady, available, id);
  const reviews = useCompanyReviews(id);

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
  const facts = [
    ["მომსახურების ქალაქები", (c.serviceCities || []).map((id: string) => cities[id] || id).join(" · ")],
    ["მისამართი", c.address],
    ["ყიდულობს", (c.seeks || []).join(" · ")],
  ].filter(([, value]) => value);

  return (
    <div className={`ma-page company-profile detail-page ${styles.page}`}>
      <Link className="ma-back" href="/companies/"><Icon name="chevron-left" />კომპანიები</Link>
      <header className={styles.hero}>
        <span className={styles.avatar}>{c.logoUrl ? <img src={c.logoUrl} alt="" /> : avatarInitials(name)}
          {c.verified ? <span className={styles.verified} role="img" aria-label="ვერიფიცირებული კომპანია"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 14.4 4l3.1-.3.9 3 2.7 1.6-1 3 1 3-2.7 1.6-.9 3-3.1-.3L12 22l-2.4-2-3.1.3-.9-3L2.9 15.7l1-3-1-3 2.7-1.6.9-3 3.1.3L12 2Z"/><path className={styles.verifiedCheck} d="m8.5 12.2 2.3 2.3 4.7-4.9"/></svg></span> : null}
        </span>
        <div className={styles.identity}>
          <h1 className={styles.name}>{name}</h1>
          <p className={styles.meta}>{[categories[c.industry] || c.industry, cities[c.city] || c.city].filter(Boolean).join(" · ")}</p>
          <p className={styles.rating}>{reviews.data ? reviews.data.total > 0 ? <><Icon name="star"/><strong>{reviews.data.rating ?? "—"}</strong><span>· {reviews.data.total} შეფასება</span></> : "შეფასებები ჯერ არ არის" : reviews.error ? "შეფასებები ვერ ჩაიტვირთა" : "შეფასებები იტვირთება…"}</p>
          {c.about?.startsWith("სადემო კომპანია.") ? <p className="company-demo-label">სადემო კომპანია · ინფორმაცია და კონტაქტები პრეზენტაციის მაგალითია.</p> : null}
        </div>
        <div className={styles.actions}>
          {ownProfile ? <Button variant="primary" href="/account/?tab=profile">რედაქტირება</Button> : <><Button variant="primary" href={`/requests/new/?category=${encodeURIComponent(c.industry || "")}`}><Icon name="file-text"/>ფასის მოთხოვნა</Button><CompanyActions companyId={c.id} name={name}/></>}
          <p className={styles.contactRule}><Icon name="lock-keyhole"/>ტელეფონი და ელფოსტა — გარიგების შემდეგ</p>
        </div>
      </header>
      <div className={styles.content}>
      <div className={styles.main}>
        {c.about || products.length ? <section aria-labelledby="company-about">
          <h2 id="company-about" className="detail-section-title">ჩვენ შესახებ</h2>
          {c.about ? <p className="company-profile-description">{c.about}</p> : null}
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

      <aside className={styles.sidebar}>
        <section className={styles.panel}><h2 className="detail-section-title">ვერიფიკაცია</h2>
          {c.verified ? <><ul className={styles.verification}>{["კომპანიის რეგისტრაცია", "საიდენტიფიკაციო კოდი", "ბიზნეს-ელფოსტა"].map(label => <li key={label}><Icon name="circle-check"/>{label}</li>)}</ul><p className={styles.privacy}>დოკუმენტები კონფიდენციალურია — ჩანს მხოლოდ შედეგი.</p></> : <span className={styles.pending}>ვერიფიკაცია მიმდინარეობს</span>}
        </section>
        {facts.length ? <section className={styles.panel}><h2 className="detail-section-title">დეტალები</h2><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section> : null}
      </aside>
      </div>
      {!ownProfile && store?.currentUser()?.role !== "admin" ? <div className={styles.report}><ReportButton kind="company" targetId={c.id} /></div> : null}
    </div>
  );
}
