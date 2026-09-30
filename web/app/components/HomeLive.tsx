"use client";

import { CustomSelect } from "./ui/CustomSelect";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMarketStore } from "../lib/market-client";
import { categories as needs } from "../lib/home-data";
import { categories as categoryLabels, categoryGroups, cities } from "../lib/categories";
import { SaveCompanyButton } from "./market/SaveCompanyButton";
import { avatarInitials, companyImage } from "./market/CompanyAvatar";
import { Icon } from "./Icon";
import { DuoIcon } from "./ui/DuoIcon";

type Company = {id: string; company: string; city: string; industry: string; logoUrl?: string | null; about: string; offers: string[]; serviceCities?: string[]};

export function HomeJoin() {
  const {store, ready} = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <section className="home-join home-wrap"><div className="home-join__panel">
    <div><h2>{company ? "ნახე, რას ეძებენ სხვა ბიზნესები" : me ? "იპოვე პარტნიორი შენი ბიზნესისთვის" : "გააცანი შენი კომპანია სხვა ბიზნესებს"}</h2><p>{company ? "ღია მოთხოვნებზე შეთავაზების გაგზავნა უფასოა." : me ? "მოძებნე კომპანია დარგისა და ქალაქის მიხედვით." : "დაარეგისტრირე კომპანია, მიიღე მოთხოვნები შენს დარგში და გაუგზავნე შეთავაზებები."}</p></div>
    <Link className="ma-btn ma-btn--lg home-join__cta" href={company ? "/requests/" : me ? "/companies/" : "/account/?tab=register&role=company"}>{company ? "ღია მოთხოვნების ნახვა" : me ? "კომპანიების მოძებნა" : "კომპანიის რეგისტრაცია"}<Icon name="arrow-right" /></Link>
  </div></section>;
}

/** Live numbers under the hero search; reserves its line while loading. */
export function HomeStats() {
  const {store, ready, available} = useMarketStore();
  const live = ready && available && store;
  const companies = live ? store.listCompanies().length : null;
  const requests = live ? (store.listRequests as (args: unknown) => unknown[])({ state: "open" }).length : null;
  return <ul className="hero-stats" aria-live="polite">
    <li><strong>{companies ?? "—"}</strong><span>კომპანია კატალოგში</span></li>
    <li><strong>{requests ?? "—"}</strong><span>ღია მოთხოვნა</span></li>
    <li><Link href="/requests/new/">გამოაქვეყნე მოთხოვნა<Icon name="arrow-right" /></Link></li>
  </ul>;
}

// Photo-first partner types (from the v1 home): picture on top, title and a short line below.
// Unsplash photos, see public/assets/photos/types/SOURCES.txt.
const typePhotos: Record<string, string> = {
  suppliers: "types/suppliers.jpg", services: "types/services.jpg",
  distributors: "types/distributors.jpg", partners: "types/partners.jpg",
};
export function HomeCategories() {
  return <div className="home-types">{needs.map(c => <Link key={c.id} className="home-type" href={`/companies/?type=${c.id}`}>
    <span className="home-type__media"><img src={`/assets/photos/${typePhotos[c.id]}`} alt="" loading="lazy" width={480} height={360} /></span>
    <strong>{c.title}</strong>
    <small>{c.sub}</small>
  </Link>)}</div>;
}

/** Airbnb-style category carousel: every category with its own thin icon, scrolls sideways
 *  (wheel, touch, drag) with round arrow buttons at the edges. */
export function HomeIndustries() {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const items = categoryGroups.flatMap(g => g.items.map(([id, label]) => ({ id, label: label as string })));
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const scroll = (dir: 1 | -1) => list.current?.scrollBy({ left: dir * list.current.clientWidth * 0.8, behavior: "smooth" });
  return <nav className="home-catbar" aria-label="კატეგორიები" data-start={edges.start || undefined} data-end={edges.end || undefined}>
    <button type="button" className="home-catbar__arrow home-catbar__arrow--prev" aria-label="წინა კატეგორიები" hidden={edges.start} onClick={() => scroll(-1)}><Icon name="chevron-left" /></button>
    <ul ref={list}>{items.map(item => <li key={item.id}><Link href={`/companies/?industry=${item.id}`}>
      <DuoIcon name={item.id} size={26} />
      <span>{item.label}</span>
    </Link></li>)}</ul>
    <button type="button" className="home-catbar__arrow home-catbar__arrow--next" aria-label="შემდეგი კატეგორიები" hidden={edges.end} onClick={() => scroll(1)}><Icon name="chevron-right" /></button>
  </nav>;
}

/** Latest open requests for companies: shows the platform is alive and gives them a reason to join. */
type OpenRequest = { id: string; title: string; category: string; city: string; createdAt: string; expiresAt: string };
export function HomeRequests() {
  const {store, ready, available} = useMarketStore();
  const [now] = useState(() => Date.now());
  const rows: OpenRequest[] = ready && available && store
    ? [...(store.listRequests as (args: unknown) => OpenRequest[])({ state: "open" })].filter(r => !/ტესტ|test|e2e/i.test(r.title)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 4)
    : [];
  return <div className="home-requests" aria-busy={!ready}>
    {!ready ? [0, 1, 2, 3].map(i => <div className="home-request home-request--skeleton" key={i}><span className="ma-skel home-company__line" /><span className="ma-skel home-company__line" /><span className="ma-skel home-company__line home-company__line--short" /></div>)
      : !rows.length ? <p className="home-empty">ღია მოთხოვნები მალე გამოჩნდება.</p>
      : rows.map(r => {
        const days = store?.daysLeft(r, now) ?? 0;
        const offers = store?.offerCount(r.id) ?? 0;
        return <article className="home-request" key={r.id}>
          <p className="home-request__category">{categoryLabels[r.category] || r.category}</p>
          <h3 className="home-request__title"><Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`}>{r.title}</Link></h3>
          <p className="home-request__meta"><Icon name="map-pin" />{cities[r.city] || r.city}</p>
          <p className="home-request__foot">
            <span><strong>{offers}</strong> შეთავაზება</span>
            <span className={days <= 3 ? "home-request__due is-soon" : "home-request__due"}>{days <= 0 ? "დღეს იწურება" : `${days} დღე დარჩა`}</span>
          </p>
        </article>;
      })}
  </div>;
}

/** Photo-first company card (home): picture or initials tile on top, text below, no frame. */
function HomeCompanyCard({ c }: { c: Company }) {
  const href = `/companies/view/?id=${encodeURIComponent(c.id)}`;
  const image = companyImage(c.company, c.logoUrl);
  const place = [c.city, ...(c.serviceCities || [])].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 2).map(id => cities[id] || id).join(", ");
  return <article className="home-company">
    <Link className="home-company__media" href={href} tabIndex={-1} aria-hidden="true">
      {image ? <img src={image} alt="" loading="lazy" width={480} height={360} /> : <span className="home-company__initials">{avatarInitials(c.company)}</span>}
    </Link>
    <div className="home-company__save"><SaveCompanyButton id={c.id} icon /></div>
    <h3 className="home-company__name"><Link href={href}>{c.company}</Link></h3>
    <p className="home-company__meta">{categoryLabels[c.industry] || c.industry}</p>
    {place ? <p className="home-company__meta">{place}</p> : null}
  </article>;
}

export function HomeFeatured() {
  const {store, ready, available} = useMarketStore();
  const all: Company[] = ready && available ? store?.listCompanies() || [] : [];
  // The home showcase skips internal test accounts (they stay in the catalog for QA).
  const rows = all.filter(c => c.about && !/სატესტო|test|e2e/i.test(c.company)).slice(0, 8);
  // Fixed-height grid while loading so the page does not shift when companies arrive.
  return <div className="home-company-grid" id="featured-companies" aria-busy={!ready}>
    {!ready ? [0, 1, 2, 3].map(i => <div className="home-company home-company--skeleton" key={i}><span className="ma-skel home-company__media" /><span className="ma-skel home-company__line" /><span className="ma-skel home-company__line home-company__line--short" /></div>)
      : !available ? <p className="home-empty">სერვისი დროებით მიუწვდომელია.</p>
      : !rows.length ? <p className="home-empty">კომპანიები მალე გამოჩნდება.</p>
      : rows.map(c => <HomeCompanyCard key={c.id} c={c} />)}
  </div>;
}

export function HomeRequestStarter() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLSelectElement>(null);
  function start(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 5) {setError("მოკლედ აღწერე, რა გჭირდება (მინიმუმ 5 სიმბოლო)."); titleRef.current?.focus(); return;}
    if (!city) {setError("აირჩიე ქალაქი."); cityRef.current?.focus(); return;}
    router.push(`/requests/new/?${new URLSearchParams({title:title.trim(), city})}`);
  }
  return <form className="request-starter-form" onSubmit={start} noValidate>
    <div className="ma-field"><label className="ma-field__label" htmlFor="starter-title">რა პროდუქტი ან მომსახურება გჭირდება?</label><input ref={titleRef} id="starter-title" className="ma-input" value={title} onChange={e => {setTitle(e.target.value);setError("");}} maxLength={120} placeholder="მაგ. 20 სამუშაო მაგიდა ოფისისთვის" aria-describedby={error ? "starter-error" : undefined} required /></div>
    <div className="request-starter-bottom"><div className="ma-field"><label className="ma-field__label" htmlFor="starter-city">რომელ ქალაქში?</label><CustomSelect ref={cityRef} id="starter-city" className="ma-select" value={city} onChange={e => {setCity(e.target.value);setError("");}} aria-describedby={error ? "starter-error" : undefined} required><option value="">აირჩიე ქალაქი</option>{Object.entries(cities).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</CustomSelect></div><button className="ma-btn ma-btn--primary ma-btn--lg" type="submit">გაგრძელება</button></div>
    {error ? <p className="request-starter-error" id="starter-error" role="alert">{error}</p> : null}
    <p className="request-starter-note">შემდეგ ნაბიჯზე დაამატებ დეტალებს. მოთხოვნა მხოლოდ შენი დადასტურების შემდეგ გამოქვეყნდება.</p>
  </form>;
}
