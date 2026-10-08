"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { categories, cities, currentCategory } from "../lib/categories";
import { HomeRequestPhoto, useHomeFeed, type HomeRequest } from "./HomeLive";
import { HeroOffer, heroOffers } from "./home/HeroOffer";
import styles from "./home/HomeSections.module.css";

function HeroRequest({ request: r, offers, duplicate = false }: { request: HomeRequest; offers: number; duplicate?: boolean }) {
  return <Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`} className="home-live-request" data-request-id={r.id} tabIndex={duplicate ? -1 : undefined}>
    <div className="home-live-visual"><HomeRequestPhoto request={r} live /><span className="home-live-category">{categories[currentCategory(r.category)] || r.category}</span></div>
    <div className="home-live-body"><p className="home-live-eyebrow">მოთხოვნა</p><h3>{r.title}</h3><div className="home-live-meta"><span><Icon name="map-pin" />{cities[r.city] || r.city}</span><span aria-label={`${offers} შეთავაზება`}><Icon name="inbox" />{offers}</span></div></div>
  </Link>;
}
export function HomeBusinessScene() {
  const [paused, setPaused] = useState(false);
  const { store, ready, available, requests } = useHomeFeed();
  const empty = <p className="home-empty">{available ? "მოთხოვნები მალე გამოჩნდება." : "სერვისი დროებით მიუწვდომელია."}</p>;
  return <>
    <div className={`hero-scene ${styles.desktopScene}`} aria-label="ახალი მოთხოვნები" data-paused={paused || undefined} aria-busy={!ready}>
      <div className="home-live-headings"><span><Icon name="file-text" />ახალი მოთხოვნები</span><span aria-hidden="true"><Icon name="inbox" />მიღებული შეთავაზებები</span></div>
      <div className="hero-scene__photos">
        <div className="hero-scene__column">{!ready ? <div className="home-live-skeleton ma-skel" /> : !requests.length ? empty : <div className="hero-scene__track">{[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>{requests.slice(0, 4).map(r => <HeroRequest key={r.id} request={r} offers={store?.offerCount(r.id) ?? 0} duplicate={duplicate} />)}</div>)}</div>}</div>
        <div className="hero-scene__column" aria-hidden="true"><div className="hero-scene__track">{[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>{heroOffers.map(o => <HeroOffer key={o.company} offer={o} />)}</div>)}</div></div>
      </div>
      <div className={styles.flowChip} aria-hidden="true"><Icon name="file-text" /><div><strong>1 მოთხოვნა — 9 შეთავაზება</strong><p>საშუალოდ პირველი 48 საათში</p></div></div>
      <button className={`hero-scene__motion ${styles.pause}`} type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "გაგრძელება" : "პაუზა"}><Icon name={paused ? "play" : "pause"} /></button>
    </div>
    <div className={styles.mobileScene} aria-busy={!ready}>{!ready ? <div className="home-live-skeleton ma-skel" /> : requests[0] ? <HeroRequest request={requests[0]} offers={store?.offerCount(requests[0].id) ?? 0} /> : empty}<div className={styles.mobileOffers} aria-hidden="true">{[heroOffers[0], heroOffers[3]].map(o => <HeroOffer key={o.company} offer={o} />)}</div></div>
  </>;
}
