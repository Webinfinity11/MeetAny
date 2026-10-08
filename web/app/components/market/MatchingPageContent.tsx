"use client";
import { useSearchParams } from 'next/navigation';
import { useState, type ComponentProps } from 'react';
import { AccountShell } from './account/AccountShell';
import { useMarketStore } from '../../lib/market-client';
import { useUnreadMessageCount } from '../../lib/chat-client';
import '../../styles/pages/account.css';
import { MatchingFeed } from './MatchingFeed';

export function MatchingPageContent() {
  const params = useSearchParams();
  const [count, setCount] = useState<number | null>(null);
  const { store, ready, available } = useMarketStore();
  const me = ready && available ? store?.currentUser() : null;
  const company = me?.role === 'company';
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && me.role !== 'admin');
  const items: ComponentProps<typeof AccountShell>['items'] = [
    { key: 'overview', label: 'მიმოხილვა', icon: 'layout-grid' },
    { key: 'opportunities', label: 'შესაძლებლობები', icon: 'search' },
    ...(company ? [{ key: 'offers' as const, label: 'ჩემი შეთავაზებები', icon: 'send', count: store?.myOffers(me).length }] : []),
    { key: 'requests', label: 'ჩემი მოთხოვნები', icon: 'clipboard-list', count: me ? store?.listRequests({ ownerId: me.id, state: '', includeHidden: true }).length : null },
    { key: 'deals', label: 'გარიგებები', icon: 'handshake' },
    { key: 'notifications', label: 'შეტყობინებები', icon: 'bell' },
    { key: 'messages', label: 'მესიჯები', icon: 'message-square', count: unread },
    { key: 'profile', label: company ? 'კომპანიის პროფილი' : 'პროფილი', icon: 'user-round' },
  ];
  const requestId = params.get('requestId') || undefined;
  const request = requestId ? store?.getRequest(requestId) : null;
  const ownRequest = request?.ownerId === me?.id ? request : null;
  return <AccountShell tab="opportunities" items={items} company={company} space="sell" title={requestId ? (ownRequest ? `მომწოდებლები მოთხოვნისთვის: ${ownRequest.title}` : 'შესაბამისი მომწოდებლები') : 'თქვენთვის შერჩეული'} lead={requestId ? 'კომპანიები ამ მოთხოვნის კატეგორიისა და ქალაქის მიხედვით.' : `${count === null ? '…' : count} შესაძლებლობა თქვენი პროფილის, პროდუქტებისა და შესყიდვების მიხედვით.`}><MatchingFeed key={requestId || 'feed'} requestId={requestId} onCount={setCount}/></AccountShell>;
}
