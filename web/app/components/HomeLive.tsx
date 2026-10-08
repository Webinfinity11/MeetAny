"use client";

import { useState } from "react";
import { OpportunityCard, OpportunitySkeleton } from "./market/OpportunityCard";
import styles from "./home/HomeSections.module.css";
import { useMarketStore } from "../lib/market-client";
import { Icon } from "./Icon";
import { RequestCatalogCover } from "./market/RequestCatalogCover";

export type HomeRequest = {
  id: string; title: string; category: string; city: string; createdAt: string;
  expiresAt: string; photo: string | null; quantity: number | null; unit: string | null;
};
export type HomeCompany = { id: string; company: string; industry: string; city: string; createdAt: string };

/** Both home sections use the existing public store; no extra data fetch or invented counts. */
export function useHomeFeed() {
  const { store, ready, available } = useMarketStore();
  const requests: HomeRequest[] = ready && available && store
    ? [...(store.listRequests({ state: "open" }) as HomeRequest[])].filter(r => !/ტესტ|test|e2e/i.test(r.title))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5) : [];
  const companies: HomeCompany[] = ready && available && store
    ? [...(store.listCompanies() as HomeCompany[])].filter(c => !/ტესტ|test|e2e/i.test(c.company))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5) : [];
  return { store, ready, available, requests, companies };
}

export function HomeRequestPhoto({ request, live = false }: { request: HomeRequest; live?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className={live ? "home-live-photo" : "home-opportunity-photo"}>
    {request.photo && failed !== request.photo
      ? <img src={request.photo} alt="" width={480} height={300} loading={live ? "eager" : "lazy"} onError={() => setFailed(request.photo)} />
      : <RequestCatalogCover category={request.category} />}
  </div>;
}

export function HomeRequests() {
  const { store, ready, available, requests } = useHomeFeed();
  const [now] = useState(() => Date.now());
  return <div className="home-opportunities" aria-busy={!ready}>
    {!ready ? Array.from({ length: 5 }, (_, i) => <OpportunitySkeleton key={i} />)
      : !requests.length ? <p className="home-empty">{available ? "ღია მოთხოვნები მალე გამოჩნდება." : "სერვისი დროებით მიუწვდომელია."}</p>
      : requests.map(r => <OpportunityCard key={r.id} compact request={{ ...r, daysLeft: store?.daysLeft(r, now) ?? 0, isNew: now >= Date.parse(r.createdAt) && now - Date.parse(r.createdAt) < 86400000 }} offers={store?.offerCount(r.id)} />)}
  </div>;
}

export function HomeTrust() {
  const { store, ready, available } = useMarketStore();
  const loaded = ready && available && store;
  return <div className={styles.trust}>
    <span><Icon name="shield-check" /><span>{loaded ? <strong>{store.listCompanies().filter((c: { verified: boolean }) => c.verified).length.toLocaleString("ka-GE")} </strong> : "— "}ვერიფიცირებული კომპანია</span></span>
    <span><Icon name="file-text" /><span>{loaded ? <strong>{store.listRequests({ state: "open" }).length.toLocaleString("ka-GE")} </strong> : "— "}აქტიური მოთხოვნა</span></span>
    <span><Icon name="lock-keyhole" />კონტაქტი იხსნება არჩევის შემდეგ</span>
  </div>;
}
