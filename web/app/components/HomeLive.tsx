"use client";

import { CustomSelect } from "./ui/CustomSelect";
import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListSkeleton } from "./market/Skeletons";
import { useMarketStore } from "../lib/market-client";
import { categories as needs, industries } from "../lib/home-data";
import { categories, cities, categoryPhoto } from "../lib/categories";
import { CompanyAvatar } from "./market/CompanyAvatar";

type Company = {id: string; company: string; city: string; industry: string; logoUrl?: string | null; about: string; offers: string[]};

export function HomeJoin() {
  const {store, ready} = useMarketStore();
  const me = ready ? store?.currentUser() : null;
  const company = me?.role === "company";
  return <section className="home-join"><div className="home-wrap"><div><span className="home-overline">{me && !company ? "ბიზნესებისთვის" : "კომპანიებისთვის"}</span><h2>{company ? "ნახე, რას ეძებენ სხვა ბიზნესები." : me ? "იპოვე პარტნიორი შენი ბიზნესისთვის." : "გააცანი შენი კომპანია სხვა ბიზნესებს."}</h2></div><Link className="home-button" href={company ? "/requests/" : me ? "/companies/" : "/account/?tab=register&role=company"}>{company ? "ღია მოთხოვნების ნახვა" : me ? "კომპანიების მოძებნა" : "დაარეგისტრირე კომპანია"}</Link></div></section>;
}

export function HomeCategories() {
  return <div className="home-role-list">{needs.map((c,index) => <Link key={c.id} href={`/companies/?type=${c.id}`}>
    <span className="home-role-object" aria-hidden="true"><img src="/assets/category-business-3d.png" alt="" style={{"--object-x": `${-100*(index%2)}%`, "--object-y": `${-100*Math.floor(index/2)}%`} as CSSProperties} /></span>
    <span><strong>{c.title}</strong><small>{c.sub}</small></span>
  </Link>)}</div>;
}

export function HomeIndustries() {
  const {store, ready, available} = useMarketStore();
  return <ul className="home-industry-grid" aria-label="საქმიანობის მიმართულებები">{industries.map(ind => <li key={ind.id}><Link href={`/companies/?industry=${ind.id}`} aria-label={ind.name}>
    <span className="home-industry-object" aria-hidden="true"><img src="/assets/industry-objects.png" alt="" style={{"--object-x":ind.x,"--object-y":ind.y} as CSSProperties} loading="lazy" /></span>
    <strong>{ind.title}</strong><span>{ready && available ? `${store?.listCompanies({industry:ind.id}).length} კომპანია` : "კომპანიების ნახვა"}</span>
  </Link></li>)}</ul>;
}

export function HomeFeatured() {
  const {store, ready, available} = useMarketStore();
  const all: Company[] = ready && available ? store?.listCompanies() || [] : [];
  return <div className="home-partner-grid" id="featured-companies" aria-busy={!ready}>{!ready ? <ListSkeleton compact label="კომპანიები იტვირთება…" /> : !available ? <p>სერვისი დროებით მიუწვდომელია.</p> : !all.length ? <p>კომპანიები მალე გამოჩნდება.</p> : all.slice(0,3).map(c => <article className="home-partner" key={c.id}>
    <Link className="home-partner-photo" href={`/companies/view/?id=${c.id}`} tabIndex={-1} aria-hidden="true"><img src={`/assets/photos/${categoryPhoto[c.industry] || categoryPhoto.other}`} alt="" width={640} height={420} loading="lazy" /><span>{categories[c.industry]}</span></Link>
    <div className="home-partner-identity"><CompanyAvatar name={c.company} logoUrl={c.logoUrl} size="lg" /><div><h3><Link href={`/companies/view/?id=${c.id}`}>{c.company}</Link></h3><p>{cities[c.city] || c.city}</p></div></div>
    <p className="home-partner-description">{c.about || c.offers.join(" · ")}</p>
    <Link className="home-text-link" href={`/companies/view/?id=${c.id}`}>პროფილის ნახვა</Link>
  </article>)}</div>;
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
    <div className="request-starter-bottom"><div className="ma-field"><label className="ma-field__label" htmlFor="starter-city">რომელ ქალაქში?</label><CustomSelect ref={cityRef} id="starter-city" className="ma-select" value={city} onChange={e => {setCity(e.target.value);setError("");}} aria-describedby={error ? "starter-error" : undefined} required><option value="">აირჩიე ქალაქი</option>{Object.entries(cities).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</CustomSelect></div><button className="home-button" type="submit">გაგრძელება</button></div>
    {error ? <p className="request-starter-error" id="starter-error" role="alert">{error}</p> : null}
    <p className="request-starter-note">შემდეგ ნაბიჯზე დაამატებ დეტალებს. მოთხოვნა მხოლოდ შენი დადასტურების შემდეგ გამოქვეყნდება.</p>
  </form>;
}
