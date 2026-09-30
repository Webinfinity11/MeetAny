"use client";

import { CustomSelect } from "./ui/CustomSelect";
import { useRef, useState } from "react";
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

/** Airbnb-style category strip: thin icon above a short label, scrolls sideways on small screens. */
export function HomeIndustries() {
  const {store, ready, available} = useMarketStore();
  return <nav className="home-catbar" aria-label="საქმიანობის მიმართულებები"><ul>{categoryGroups.filter(g => g.id !== "other").map(group => {
    const count = ready && available ? store?.listCompanies({industry: group.id}).length : null;
    return <li key={group.id}><Link href={`/companies/?industry=${group.id}`} title={count ? `${group.short} — ${count} კომპანია` : group.short}>
      <DuoIcon name={group.icon} size={26} />
      <span>{group.short}</span>
    </Link></li>;
  })}</ul></nav>;
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
  const rows = all.filter(c => c.about).slice(0, 8);
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
