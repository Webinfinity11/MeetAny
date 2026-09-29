"use client";

import { CustomSelect } from "./ui/CustomSelect";
import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMarketStore } from "../lib/market-client";
import { categories as needs } from "../lib/home-data";
import { categoryGroups, cities } from "../lib/categories";
import { CompanyListingCard, type CompanyListingData } from "./market/CompanyListingCard";
import { Icon } from "./Icon";

type Company = {id: string; company: string; city: string; industry: string; logoUrl?: string | null; about: string; offers: string[]; serviceCities?: string[]};

export function HomeJoin() {
  const {store, ready} = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <section className="home-join home-wrap"><div className="home-join__panel">
    <div><p className="home-overline">{me && !company ? "ბიზნესებისთვის" : "კომპანიებისთვის"}</p><h2>{company ? "ნახე, რას ეძებენ სხვა ბიზნესები" : me ? "იპოვე პარტნიორი შენი ბიზნესისთვის" : "გააცანი შენი კომპანია სხვა ბიზნესებს"}</h2><p>{company ? "ღია მოთხოვნებზე შეთავაზების გაგზავნა უფასოა." : me ? "მოძებნე კომპანია დარგისა და ქალაქის მიხედვით." : "დაარეგისტრირე კომპანია, მიიღე მოთხოვნები შენს დარგში და გაუგზავნე შეთავაზებები."}</p></div>
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

export function HomeCategories() {
  return <div className="home-role-list">{needs.map((c, index) => <Link key={c.id} href={`/companies/?type=${c.id}`}>
    <span className="home-3d home-3d--role" aria-hidden="true" style={{backgroundPosition: `${(index % 2) * 100}% ${Math.floor(index / 2) * 100}%`} as CSSProperties} />
    <span><strong>{c.title}</strong><small>{c.sub}</small></span>
    <Icon name="arrow-right" />
  </Link>)}</div>;
}

// 3D objects exist for eight groups (industry-objects.png, 4×2); the rest stay one click away in the catalog.
const industryObjects: [group: string, col: number, row: number][] = [
  ["interior", 0, 0], ["marketing", 1, 0], ["logistics", 2, 0], ["food", 3, 0],
  ["production", 0, 1], ["tourism", 1, 1], ["business", 2, 1], ["it", 3, 1],
];

export function HomeIndustries() {
  const {store, ready, available} = useMarketStore();
  return <ul className="home-industry-grid" aria-label="საქმიანობის მიმართულებები">{industryObjects.map(([id, col, row]) => {
    const group = categoryGroups.find(g => g.id === id);
    if (!group) return null;
    const count = ready && available ? store?.listCompanies({industry: group.id}).length : null;
    return <li key={group.id}><Link href={`/companies/?industry=${group.id}`}>
      <span className="home-3d home-3d--industry" aria-hidden="true" style={{backgroundPosition: `${col * 100 / 3}% ${row * 100}%`} as CSSProperties} />
      <span className="home-industry-text"><strong>{group.short}</strong><small>{count == null ? "\u00a0" : count ? `${count} კომპანია` : "მალე"}</small></span>
    </Link></li>;
  })}</ul>;
}

export function HomeFeatured() {
  const {store, ready, available} = useMarketStore();
  const all: Company[] = ready && available ? store?.listCompanies() || [] : [];
  const rows: CompanyListingData[] = all.filter(c => c.about).slice(0, 3).map(c => ({
    id: c.id, name: c.company, logoUrl: c.logoUrl, industry: c.industry, city: c.city,
    serviceCities: c.serviceCities || [], offers: c.offers || [], about: c.about || "", verified: false,
    stats: store?.companyStats(c.id) || { sent: 0, chosen: 0 },
  }));
  // Fixed-height grid while loading so the page does not shift when companies arrive.
  return <div className="home-partner-grid company-directory-list" id="featured-companies" aria-busy={!ready}>
    {!ready ? [0, 1, 2].map(i => <div className="catalog-skeleton__card home-partner-skeleton" key={i}><span className="ma-skel catalog-skeleton__avatar" /><span className="ma-skel catalog-skeleton__title" /><span className="ma-skel catalog-skeleton__line" /><span className="ma-skel catalog-skeleton__line catalog-skeleton__line--short" /></div>)
      : !available ? <p className="home-empty">სერვისი დროებით მიუწვდომელია.</p>
      : !rows.length ? <p className="home-empty">კომპანიები მალე გამოჩნდება.</p>
      : rows.map(c => <CompanyListingCard key={c.id} c={c} />)}
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
