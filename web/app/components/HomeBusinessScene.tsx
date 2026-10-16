"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { categories, cities, currentCategory } from "../lib/categories";
import { HomeRequestPhoto, useHomeFeed, type HomeRequest } from "./HomeLive";
import { HeroOffer, heroOffers } from "./home/HeroOffer";
import type { PublicSnapshot } from "../lib/market-client";

function HeroRequest({ request: r, offers, duplicate = false }: { request: HomeRequest; offers: number; duplicate?: boolean }) {
  return <Link href={`/requests/view/?id=${encodeURIComponent(r.id)}`} className="home-live-request" data-request-id={r.id} tabIndex={duplicate ? -1 : undefined}>
    <div className="home-live-visual"><HomeRequestPhoto request={r} live /><span className="home-live-category">{categories[currentCategory(r.category)] || r.category}</span></div>
    <div className="home-live-body"><p className="home-live-eyebrow">მოთხოვნა</p><h3>{r.title}</h3><div className="home-live-meta"><span><Icon name="map-pin" />{cities[r.city] || r.city}</span>{offers > 0 ? <span><Icon name="inbox" />{offers} შეთავაზება</span> : null}</div></div>
  </Link>;
}
/** The live strip the owner keeps: newest requests on the left, schematic offers arriving on the right.
 * It shows the requests after the five in the "ახალი მოთხოვნები" grid, so the page never repeats a card. */
export function HomeBusinessScene({ initial }: { initial?: PublicSnapshot }) {
  const [paused, setPaused] = useState(false);
  const { store, ready, available, requests } = useHomeFeed(initial);
  const shown = requests.length >= 9 ? requests.slice(5, 9) : requests.slice(0, 4);
  const empty = <p className="home-empty">{available ? "მოთხოვნები მალე გამოჩნდება." : "სერვისი დროებით მიუწვდომელია."}</p>;
  return <div className="hero-scene" aria-label="ახლახან განთავსებული მოთხოვნები" data-paused={paused || undefined} aria-busy={!ready}>
    <div className="hero-scene__photos">
      <div className="hero-scene__column">{!ready ? <div className="home-live-skeleton ma-skel" /> : !shown.length ? empty : <div className="hero-scene__track">{[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>{shown.map(r => <HeroRequest key={r.id} request={r} offers={store?.offerCount(r.id) ?? 0} duplicate={duplicate} />)}</div>)}</div>}</div>
      <div className="hero-scene__column" aria-hidden="true"><div className="hero-scene__track">{[true, false].map(duplicate => <div className="hero-scene__group" key={String(duplicate)} aria-hidden={duplicate || undefined}>{heroOffers.map(o => <HeroOffer key={o.id} offer={o} />)}</div>)}</div></div>
    </div>
    <p className="hero-scene__caption">რეალური მოთხოვნები · შეთავაზებების ნიმუშები</p>
    {/* Hover and focus pause the strip; the visible button also works with touch. */}
    <button className="hero-scene__motion" type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} aria-label={paused ? "გაგრძელება" : "პაუზა"}><Icon name={paused ? "play" : "pause"} /></button>
  </div>;
}
