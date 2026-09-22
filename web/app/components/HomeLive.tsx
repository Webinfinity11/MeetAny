"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { useMarketStore } from "../lib/market-client";
import { categories as needs, industries } from "../lib/home-data";
import { categories, cities } from "../lib/categories";
import { initials } from "./market/CompanyAvatar";

type Company = {id: string; company: string; city: string; industry: string; verified: boolean; about: string; offers: string[]};
export function HomeCategories() {
  return <div className="category-grid" id="category-grid">{needs.map((c,index) => <Link key={c.id} className={`category-card category-${c.id}`} href={`/companies/?type=${c.id}`}><span className="category-icon" aria-hidden="true"><img className="category-3d-sheet" src="/assets/category-business-3d.png" alt="" style={{"--category-x": `${-100*(index%2)}%`, "--category-y": `${-100*Math.floor(index/2)}%`} as React.CSSProperties} decoding="async"/><Icon name={c.icon}/></span><div><h3>{c.title}</h3><p>{c.sub}</p></div><Icon name="arrow-up-right" className="category-arrow"/></Link>)}</div>;
}
export function HomeIndustries() {
  const {store, ready, available} = useMarketStore();
  return <ul className="industry-list" id="industry-list" aria-label="საქმიანობის მიმართულებები">{industries.map(ind => <li key={ind.id}><Link href={`/companies/?industry=${ind.id}`} aria-label={ind.name}><span className="industry-icon industry-object" aria-hidden="true"><img src="/assets/industry-objects.png" alt="" style={{"--object-x":ind.x,"--object-y":ind.y} as React.CSSProperties} decoding="async" loading="lazy"/></span><span className="industry-title tt">{ind.title}</span><span className="industry-count">{ready && available ? `${store?.listCompanies({industry:ind.id}).length} კომპანია` : ""}</span></Link></li>)}</ul>;
}
export function HomeFeatured() {
  const {store, ready, available} = useMarketStore();
  const all: Company[] = ready && available ? store?.listCompanies() : [];
  const list = [...all].sort((a,b) => Number(b.verified) - Number(a.verified)).slice(0,3);
  return <div className="m-list" id="featured-companies" aria-busy={!ready}>{!ready ? <p role="status">იტვირთება…</p> : !available ? <p>სერვისი დროებით მიუწვდომელია.</p> : !list.length ? <div className="m-empty"><h2>კომპანიები მალე გამოჩნდება</h2><Link className="m-btn m-btn-primary" href="/account/?tab=register&role=company">დაარეგისტრირე კომპანია</Link></div> : list.map(c => {
    const stats=store?.companyStats(c.id);
    return <article className="m-company" key={c.id}><span className="m-avatar" style={{background:"var(--action)"}} aria-hidden="true">{initials(c.company)}</span><div><h3><Link href={`/companies/view/?id=${c.id}`}>{c.company}</Link>{c.verified ? <span className="m-verified"><Icon name="badge-check"/>დადასტურებული</span> : null}</h3><div className="m-sub">{categories[c.industry]} · {cities[c.city]}</div>{c.about ? <p>{c.about}</p> : null}<div className="m-tags">{c.offers.slice(0,3).map(t => <span key={t} className="m-chip plain">{t}</span>)}</div></div><div className="m-company-side"><span className="m-count"><Icon name="send"/><b>{stats.sent}</b> შეთავაზება{stats.chosen ? ` · ${stats.chosen} არჩეული` : ""}</span><Link className="m-btn m-btn-secondary m-btn-sm" href={`/companies/view/?id=${c.id}`}>პროფილი <Icon name="arrow-right"/></Link></div></article>;
  })}</div>;
}
