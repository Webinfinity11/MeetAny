"use client";

import { ProfileSkeleton } from "./Skeletons";

import { ServiceUnavailable } from "./ServiceUnavailable";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "../Icon";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { avatarInitials, companyImage } from "./CompanyAvatar";
import { CompanyGallery } from "./CompanyGallery";
import { SaveCompanyButton } from "./SaveCompanyButton";
import { CallButton } from "./CallButton";
import { MessageButton } from "./ChatPopup";
import { useMarketStore, type PublicSnapshot } from "../../lib/market-client";
import { categories, cities } from "../../lib/categories";
import { sinceMonthLabel } from "../../lib/format";
import { usePublicPhone } from "../../lib/phones";
import { useCompanyDetail } from "../../lib/use-company-detail";
import dynamic from "next/dynamic";

// Leaflet loads only for companies that have coordinates.
const CompaniesMap = dynamic(() => import("./CompaniesMap").then(m => m.CompaniesMap), {
  ssr: false,
  loading: () => <div className="companies-map companies-map--compact"><div className="companies-map__loading" role="status">რუკა იტვირთება…</div></div>,
});

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

  const requestHref = (title: string) => `/requests/new/?${new URLSearchParams({ title, category: c.industry, city: c.city })}`;
  const gallery: string[] = c.gallery || [];
  // Gallery: the company's own photos, else the logo/sample photo; then any product photos (unique).
  const photos = [...(gallery.length ? gallery : [companyImage(name, c.logoUrl)]), ...pictured.map(p => p.photoUrl)]
    .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
  // One photo sits beside the name; with a mosaic above, an uploaded logo takes that place instead.
  const thumb = photos.length < 2 ? photos[0] || "" : gallery.length && c.logoUrl ? c.logoUrl : null;

  const since = sinceMonthLabel(c.createdAt);
  const hasDetails = !!(c.about || c.seeks?.length || products.length || openRequests.length);

  return (
    <div className="ma-page company-profile detail-page">
      <Link className="ma-back" href="/companies/"><Icon name="arrow-left" />კომპანიების კატალოგი</Link>
      <CompanyGallery photos={photos} name={name} />
      <header className="company-hero">
        {thumb !== null ? <span className="company-hero__thumb">{thumb ? <img src={thumb} alt="" /> : <span aria-hidden="true">{avatarInitials(name)}</span>}</span> : null}
        <div className="company-hero__text">
          <p className="company-hero__industry">{categories[c.industry] || c.industry}</p>
          <h1 className="company-hero__name">{name}</h1>
          <ul className="company-hero__meta" aria-label="კომპანიის დეტალები">
            {c.city ? <li><Icon name="map-pin" />{cities[c.city] || c.city}</li> : null}
            {since ? <li><Icon name="calendar" />საიტზე {since}</li> : null}
            {stats.sent > 0 ? <li><Icon name="send" />{stats.sent} შეთავაზება</li> : null}
          </ul>
        </div>
        {!ownProfile ? <div className="company-hero__save"><SaveCompanyButton id={c.id} /></div> : null}
      </header>
      <nav className="company-section-nav" aria-label="კომპანიის პროფილის სექციები">{c.about || c.seeks?.length ? <a href="#company-about">კომპანიის შესახებ</a> : null}{products.length ? <a href="#offers">პროდუქტები და მომსახურება <span>{products.length}</span></a> : null}{openRequests.length ? <a href="#company-requests">ღია მოთხოვნები <span>{openRequests.length}</span></a> : null}</nav>
      <div className="company-profile-layout">
      <aside className="company-contact-card" aria-labelledby="company-contact-heading">
        <h2 id="company-contact-heading" className="detail-section-title">კონტაქტი</h2>
        <p>{ownProfile ? "ეს შენი კომპანიის საჯარო გვერდია. ინფორმაცია შეგიძლია ანგარიშიდან განაახლო." : "დაუკავშირდი კომპანიას პირობების დასაზუსტებლად."}</p>
        <div className="company-contact-actions">{ownProfile ? <Link className="ma-btn ma-btn--primary" href="/account/?tab=profile">პროფილის რედაქტირება</Link> : <>{phone ? <CallButton phone={phone} contactId={c.id} source="company-profile" /> : null}<MessageButton companyId={c.id}/></>}</div>
        {c.serviceCities?.length ? <div className="company-profile-coverage"><span>მომსახურების არეალი</span><p>{c.serviceCities.map((id: string) => cities[id] || id).join(" · ")}</p></div> : null}
        {Number.isFinite(c.lat) && Number.isFinite(c.lng) ? <CompaniesMap compact companies={[{ id: c.id, name, industry: c.industry, city: c.city, lat: c.lat, lng: c.lng }]} /> : null}
        {c.address || directions ? <div className="company-contact-address"><span>მისამართი</span>{c.address ? <p>{c.address}</p> : null}{directions ? <a href={directions} target="_blank" rel="noopener noreferrer"><Icon name="map-pin" />რუკაზე ნახვა</a> : null}</div> : null}
      </aside>
      <div className="company-profile-main">
        {!hasDetails ? <section className="company-profile-brief"><p>{ownProfile ? "დაამატე აღწერა, მომსახურება და პროდუქტები, რომ მომხმარებლებმა უკეთ გაიგონ, რას აკეთებ." : "პირობებისა და მომსახურების დეტალებისთვის დაუკავშირდი კომპანიას პირდაპირ."}</p></section> : null}
        {c.about || c.seeks?.length ? <section aria-labelledby="company-about">
          <h2 id="company-about" className="detail-section-title">კომპანიის შესახებ</h2>
          {c.about ? <p className="company-profile-description">{c.about}</p> : null}
          {c.seeks?.length ? <div className="company-profile-seeks"><h3>რას ეძებს კომპანია</h3><p>{c.seeks.join(", ")}</p></div> : null}
        </section> : null}
        {products.length ? <section id="offers" aria-labelledby="company-services">
          <h2 id="company-services" className="detail-section-title">პროდუქტები და მომსახურება</h2>
          {pictured.length ? <div className="company-product-grid">{pictured.map((product, index) => <div key={`${product.name}-${index}`}><ProductCard {...product} /></div>)}</div> : null}
          {plain.length ? <ul className="company-profile-services">{plain.map((product, index) => <li key={`${product.name}-${index}`}><Icon name="check" /><span>{product.name}</span></li>)}</ul> : null}
          {!ownProfile ? <div className="company-profile-cta"><p>გჭირდება რომელიმე მათგანი?</p><Link className="ma-btn ma-btn--secondary" href={requestHref(products[0]?.name || "")}>მოთხოვნის გამოქვეყნება</Link></div> : null}
        </section> : null}
        {openRequests.length ? <section className="company-profile-requests" aria-labelledby="company-requests">
          <h2 id="company-requests" className="detail-section-title">ღია მოთხოვნები</h2>
          <div className="company-profile-request-list">
            {openRequests.map((r) => <article key={r.id}>
              <h3><Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`}>{r.title}</Link></h3>
              <p>{r.city} · {r.offerCount} შეთავაზება</p>
            </article>)}
          </div>
        </section> : null}
      </div>

      </div>

    </div>
  );
}
