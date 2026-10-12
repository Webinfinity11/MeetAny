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
  const requestId = params.get('requestId') || undefined;
  const space = requestId || !company ? 'buy' : 'sell';
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && me.role !== 'admin');
  const items: ComponentProps<typeof AccountShell>['items'] = [
    ...(space === 'sell' ? [{ key: 'overview' as const, label: 'მიმოხილვა', icon: 'layout-grid' }] : [{ key: 'requests' as const, label: 'ჩემი მოთხოვნები', icon: 'clipboard-list', count: me ? store?.listRequests({ ownerId: me.id, state: '', includeHidden: true }).length : null }]),
    { key: 'opportunities', label: requestId ? 'შესაბამისი მომწოდებლები' : 'რეკომენდაციები', icon: 'search', href: requestId ? `/matching/?requestId=${encodeURIComponent(requestId)}` : '/matching/' },
    ...(space === 'sell' ? [{ key: 'offers' as const, label: 'ჩემი შეთავაზებები', icon: 'send', count: store?.myOffers(me).length }] : []),
    { key: 'deals', label: 'გარიგებები', icon: 'handshake' },
    { key: 'notifications', label: 'შეტყობინებები', icon: 'bell' },
    { key: 'messages', label: 'მესიჯები', icon: 'message-square', count: unread },
    { key: 'saved', label: 'შენახული კომპანიები', icon: 'bookmark' },
    { key: 'profile', label: company ? 'კომპანიის პროფილი' : 'პროფილი', icon: 'user-round' },
  ];
  const request = requestId ? store?.getRequest(requestId) : null;
  const ownRequest = request?.ownerId === me?.id ? request : null;
  return <AccountShell tab="opportunities" items={items} company={company} space={space} title={requestId ? (ownRequest ? `მომწოდებლები მოთხოვნისთვის: ${ownRequest.title}` : 'შესაბამისი მომწოდებლები') : 'თქვენთვის შერჩეული'} lead={requestId ? 'კომპანიები ამ მოთხოვნის კატეგორიისა და ქალაქის მიხედვით.' : `${count === null ? '…' : count} შედეგი — მოთხოვნები და მომწოდებლები თქვენი ინტერესების მიხედვით.`}><MatchingFeed key={requestId || 'feed'} requestId={requestId} onCount={setCount}/></AccountShell>;
}
