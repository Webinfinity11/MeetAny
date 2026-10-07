"use client";

import { useState } from "react";
import Link from "next/link";
import { useMarketStore } from "../lib/market-client";
import { categories, cities, currentCategory, units } from "../lib/categories";
import { Icon } from "./Icon";
import { Badge } from "./ui/Badge";

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
      : <span className="home-photo-placeholder" aria-hidden="true"><Icon name="file-text" /></span>}
  </div>;
}

export function HomeRequests() {
  const { store, ready, available, requests } = useHomeFeed();
  // The clock is only rendered after the store has hydrated, matching the catalog's 24h rule.
  const [now] = useState(() => Date.now());
  return <div className="home-opportunities" aria-busy={!ready}>
    {!ready ? Array.from({ length: 5 }, (_, i) => <div className="home-opportunity" key={i} aria-hidden="true">
      <div className="home-opportunity-photo ma-skel" /><div className="home-opportunity-body"><span className="ma-skel home-company__line" /><span className="ma-skel home-company__line" /><span className="ma-skel home-company__line home-company__line--short" /></div>
    </div>) : !requests.length ? <p className="home-empty">{available ? "ღია მოთხოვნები მალე გამოჩნდება." : "სერვისი დროებით მიუწვდომელია."}</p>
      : requests.map(r => {
        const days = store?.daysLeft(r, now) ?? 0;
        const age = now - Date.parse(r.createdAt);
        return <Link className="home-opportunity" href={`/requests/view/?id=${encodeURIComponent(r.id)}`} key={r.id}>
          <div className="home-opportunity-visual">
            <HomeRequestPhoto request={r} />
            {age >= 0 && age < 86400000 ? <Badge className="home-opportunity-new" status="success">ახალი</Badge> : null}
            <div className="home-opportunity-chips">
              <span>{categories[currentCategory(r.category)] || r.category}</span>
              <Badge status={days <= 5 ? "warning" : "neutral"}>{days <= 0 ? "დღეს იწურება" : `${days} დღე დარჩა`}</Badge>
            </div>
          </div>
          <div className="home-opportunity-body">
            <h3>{r.title}</h3>
            <p><Icon name="map-pin" />{cities[r.city] || r.city}</p>
            {r.quantity != null ? <p><Icon name="package" />{r.quantity} {r.unit ? units[r.unit] || r.unit : ""}</p> : null}
          </div>
        </Link>;
      })}
  </div>;
}
