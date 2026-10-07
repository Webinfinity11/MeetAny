"use client";
import { useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';
import { AccountTabs } from './AccountPageContent';
import { useMarketStore } from '../../lib/market-client';
import { useUnreadMessageCount } from '../../lib/chat-client';
import '../../styles/pages/account.css';
import { MatchingFeed } from './MatchingFeed';
import { validRequestId } from '../../lib/matching-client';
import styles from './Matching.module.css';

export function MatchingPageContent() {
  const params = useSearchParams();
  const { store, ready, available } = useMarketStore();
  const me = ready && available ? store?.currentUser() : null;
  const company = me?.role === 'company';
  const unread = useUnreadMessageCount(store, me?.id, !!me && !me.blocked && me.role !== 'admin');
  const items: ComponentProps<typeof AccountTabs>['items'] = [
    { key: 'overview', label: 'მიმოხილვა', icon: 'layout-grid' },
    { key: 'opportunities', label: 'შესაძლებლობები', icon: 'search' },
    ...(company ? [{ key: 'offers' as const, label: 'ჩემი შეთავაზებები', icon: 'send', count: store?.myOffers(me).length }] : []),
    { key: 'requests', label: 'ჩემი მოთხოვნები', icon: 'clipboard-list', count: me ? store?.listRequests({ ownerId: me.id, state: '', includeHidden: true }).length : null },
    { key: 'messages', label: 'მესიჯები', icon: 'message-square', count: unread },
    { key: 'profile', label: company ? 'კომპანიის პროფილი' : 'პროფილი', icon: 'user-round' },
  ];
  const requestId = params.get('requestId') || undefined;
  return <div className={`ma-page account-page ${styles.page}`}><AccountTabs tab="opportunities" items={items} company={company}/><div className={styles.main}><header><h1>{requestId ? 'შესაბამისი მომწოდებლები' : 'თქვენთვის შერჩეული'}</h1><p>{requestId ? 'კომპანიები ამ მოთხოვნის კატეგორიისა და ქალაქის მიხედვით.' : 'ღია მოთხოვნები თქვენი კომპანიის მიწოდების კატეგორიებით.'}</p></header>{requestId && !validRequestId(requestId) ? <p role="alert">მოთხოვნის მისამართი არასწორია.</p> : <MatchingFeed key={requestId || 'feed'} requestId={requestId}/>}</div></div>;
}
