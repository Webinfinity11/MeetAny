"use client";
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AccountShell } from './account/AccountShell';
import { useAccountNav } from './account/nav';
import type { AnyUser } from './account/shared';
import { useMarketStore } from '../../lib/market-client';
import '../../styles/pages/account.css';
import { MatchingFeed } from './MatchingFeed';

export function MatchingPageContent() {
  const params = useSearchParams();
  const [count, setCount] = useState<number | null>(null);
  const { store, ready, available } = useMarketStore();
  const me = ready && available ? store?.currentUser() as AnyUser | null : null;
  const company = me?.role === 'company';
  const requestId = params.get('requestId') || undefined;
  // Suppliers for one of my requests belong to buying; the feed itself is the seller's "opportunities".
  const space = requestId || !company ? 'buy' : 'sell';
  const items = useAccountNav(store, me, space);
  const request = requestId ? store?.getRequest(requestId) : null;
  const ownRequest = request?.ownerId === me?.id ? request : null;
  return <AccountShell tab={requestId ? 'requests' : company ? 'opportunities' : 'overview'} items={items} company={company} space={space} title={requestId ? (ownRequest ? `მომწოდებლები მოთხოვნისთვის: ${ownRequest.title}` : 'შესაბამისი მომწოდებლები') : company ? 'შესაძლებლობები' : 'თქვენთვის შერჩეული'} lead={requestId ? 'კომპანიები ამ მოთხოვნის კატეგორიისა და ქალაქის მიხედვით.' : count === null ? undefined : `${count} შედეგი თქვენი ინტერესების მიხედვით.`}><MatchingFeed key={requestId || 'feed'} requestId={requestId} onCount={setCount}/></AccountShell>;
}
