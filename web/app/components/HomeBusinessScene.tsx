"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { categories, cities, currentCategory } from "../lib/categories";
import { HomeRequestPhoto, useHomeFeed } from "./HomeLive";

export function HomeBusinessScene() {
  const [paused, setPaused] = useState(false);
  const { store, ready, available, requests, companies } = useHomeFeed();
  return <div className="hero-scene" aria-label="ახალი მოთხოვნები და კომპანიები" data-paused={paused || undefined} aria-busy={!ready}>
    <div className="home-live-headings"><span><Icon name="file-text" />ახალი მოთხოვნები</span><span><Icon name="building-2" />ახალი კომპანიები</span></div>
    <div className="hero-scene__photos">
      {["requests", "companies"].map((kind, index) => <div className="hero-scene__column" key={kind}>
        {!ready ? <div className="hero-scene__group" aria-hidden="true">{[0, 1, 2].map(i => <div className={`home-live-skeleton home-live-skeleton--${kind} ma-skel`} key={i} />)}</div>
          : !(index === 0 ? requests.length : companies.length) ? <p className="home-empty">{!available ? "სერვისი დროებით მიუწვდომელია." : index === 0 ? "მოთხოვნები მალე გამოჩნდება." : "კომპანიები მალე გამოჩნდება."}</p>
          : <div className="hero-scene__track">
            {/* Identical groups preserve the existing descending loop. Only one copy is focusable. */}
            {[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {index === 0 ? requests.map(r => <Link key={r.id} href={`/requests/view/?id=${encodeURIComponent(r.id)}`} className="home-live-request" tabIndex={duplicate ? -1 : undefined}>
                <div className="home-live-visual"><HomeRequestPhoto request={r} live /><span className="home-live-category">{categories[currentCategory(r.category)] || r.category}</span></div>
                <div className="home-live-body"><p className="home-live-eyebrow">მოთხოვნა</p><h3>{r.title}</h3>
                  <div className="home-live-meta"><span><Icon name="map-pin" />{cities[r.city] || r.city}</span><span aria-label={`${store?.offerCount(r.id) ?? 0} შეთავაზება`}><Icon name="inbox" />{store?.offerCount(r.id) ?? 0}</span></div>
                </div>
              </Link>) : companies.map(c => <Link key={c.id} href={`/companies/view/?id=${encodeURIComponent(c.id)}`} className="home-live-company" tabIndex={duplicate ? -1 : undefined}>
                <span className="home-live-initials" aria-hidden="true">{c.company.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("")}</span>
                <div><h3>{c.company}</h3><p>{categories[currentCategory(c.industry)] || c.industry}</p><p><Icon name="map-pin" />{cities[c.city] || c.city}</p></div>
              </Link>)}
            </div>)}
          </div>}
      </div>)}
    </div>
    {ready && (requests.length > 0 || companies.length > 0) ? <button className="hero-scene__motion" type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"} title={paused ? "ანიმაციის ჩართვა" : "ანიმაციის შეჩერება"}><Icon name={paused ? "play" : "pause"} /></button> : null}
  </div>;
}
