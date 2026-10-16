"use client";

import { optimizable } from "../lib/image";
import Image from "next/image";
import { useState } from "react";
import { OpportunityCard, OpportunitySkeleton } from "./market/OpportunityCard";
import { useMarketStore, type PublicSnapshot } from "../lib/market-client";
import { requestCoverPhoto } from "../lib/request-cover";

export type HomeRequest = {
  id: string; title: string; category: string; city: string; createdAt: string;
  expiresAt: string; photo: string | null; quantity: number | null; unit: string | null;
};
export type HomeCompany = { id: string; company: string; industry: string; city: string; createdAt: string };

/** Both home sections use the existing public store; no extra data fetch or invented counts.
 * Up to nine requests: the grid takes the newest five, the live strip the next four. */
export function useHomeFeed(initial?: PublicSnapshot) {
  const { store, ready, available } = useMarketStore(initial);
  const requests: HomeRequest[] = ready && available && store
    ? [...(store.listRequests({ state: "open" }) as HomeRequest[])].filter(r => !/ტესტ|test|e2e/i.test(r.title))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 9) : [];
  const companies: HomeCompany[] = ready && available && store
    ? [...(store.listCompanies() as HomeCompany[])].filter(c => !/ტესტ|test|e2e/i.test(c.company))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5) : [];
  return { store, ready, available, requests, companies };
}

export function HomeRequestPhoto({ request, live = false }: { request: HomeRequest; live?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const supplied = !!request.photo && failed !== request.photo;
  const src = supplied ? request.photo! : requestCoverPhoto(request.category);
  return <div className={live ? "home-live-photo" : "home-opportunity-photo"}>
    <Image src={src} alt="" width={480} height={300} sizes="(max-width: 479px) calc(100vw - 32px), (max-width: 1023px) 45vw, 280px" unoptimized={!optimizable(src)} loading="lazy" onError={supplied ? () => setFailed(request.photo) : undefined} />
    {!supplied && <span className="home-live-photo__note">თემატური ფოტო</span>}
  </div>;
}

export function HomeRequests({ initial, initialNow }: { initial?: PublicSnapshot; initialNow?: number }) {
  const { store, ready, available, requests } = useHomeFeed(initial);
  // The server clock renders the deadlines in the HTML; hydration must reuse it.
  const [now] = useState(() => initialNow ?? Date.now());
  return <div className="home-opportunities" aria-busy={!ready}>
    {!ready ? Array.from({ length: 5 }, (_, i) => <OpportunitySkeleton key={i} />)
      : !requests.length ? <p className="home-empty">{available ? "ღია მოთხოვნები მალე გამოჩნდება." : "სერვისი დროებით მიუწვდომელია."}</p>
      : requests.slice(0, 5).map(r => <OpportunityCard key={r.id} compact media={<HomeRequestPhoto request={r} />} request={{ ...r, daysLeft: store?.daysLeft(r, now) ?? 0, isNew: now >= Date.parse(r.createdAt) && now - Date.parse(r.createdAt) < 86400000 }} offers={store?.offerCount(r.id)} />)}
  </div>;
}
