"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMarketStore } from '../../../lib/market-client';
import { flowError, listMatching, matchingPageSize, validRequestId, type MatchingItem } from '../../../lib/matching-client';
import { cities } from '../../../lib/categories';
import { Button } from '../../ui/Button';
import { CustomSelect } from '../../ui/CustomSelect';
import { EmptyState } from '../../ui/Structure';
import { ListSkeleton } from '../Skeletons';
import { OpportunityCard } from '../OpportunityCard';
import { CompanyListingCard } from '../CompanyListingCard';
import styles from '../Matching.module.css';

export function FullMatchingFeed({ requestId }: { requestId?: string }) {
  const { store, ready, sessionReady, available } = useMarketStore();
  const me = sessionReady ? store?.currentUser() : null;
  const target = requestId && validRequestId(requestId) ? store?.getRequest(requestId) : null;
  const own = !!target && target.ownerId === me?.id;
  const closed = own && (target.hidden || store?.requestState(target) !== 'open');
  const allowed = !closed && ready && !!me && !me.blocked && (requestId ? own : me.role === 'company');
  const [city, setCity] = useState('');
  const [verified, setVerified] = useState(false);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const scope = JSON.stringify([me?.id, requestId, city, allowed]);
  const key = JSON.stringify([scope, offset, retry]);
  const [result, setResult] = useState<{ scope: string; key: string; items: MatchingItem[]; more: boolean; error?: string }>();
  const callRpc = store?.callRpc;
  useEffect(() => {
    if (!allowed || !callRpc) return;
    let active = true;
    void listMatching({ callRpc }, requestId || null, city, offset).then(page => {
      if (active) setResult(previous => ({ scope, key, items: [...new Map([...(offset && previous?.scope === scope ? previous.items : []), ...page].map(item => [item.id, item])).values()], more: page.length === matchingPageSize }));
    }, error => {
      if (active) setResult(previous => ({ scope, key, items: previous?.scope === scope ? previous.items : [], more: true, error: flowError(error) }));
    });
    return () => { active = false; };
  }, [allowed, callRpc, requestId, city, offset, scope, key]);
  if (!ready || !sessionReady) return <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/>;
  if (!available) return <EmptyState title="სერვისი დროებით მიუწვდომელია" text="სცადეთ მოგვიანებით."/>;
  if (!me) return <EmptyState title="შედით ანგარიშში" text="შესაბამისი შესაძლებლობები თქვენი პროფილით შეირჩევა." action={<Button href="/account/">შესვლა</Button>}/>;
  if (me.blocked) return <EmptyState title="ანგარიში დაბლოკილია" text="შესაძლებლობები მიუწვდომელია."/>;
  if (requestId && !own) return <EmptyState title="მოთხოვნა ვერ მოიძებნა" text="აირჩიეთ თქვენი მოთხოვნა მომწოდებლების სანახავად." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (closed) return <EmptyState title="მოთხოვნა აღარ არის ღია" text="მომწოდებლების შესარჩევად აირჩიეთ აქტიური მოთხოვნა." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (!allowed) return <EmptyState title="აირჩიეთ თქვენი მოთხოვნა" text="შესაბამისი მომწოდებლები მოთხოვნის კატეგორიით შეირჩევა." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  const current = result?.scope === scope ? result : undefined;
  const loading = current?.key !== key;
  const items = (current?.items || []).filter(item => requestId || !verified || store?.userById(store?.getRequest(item.id)?.ownerId)?.verified);
  return <section className={styles.feed} aria-label={requestId ? 'შესაბამისი მომწოდებლები' : 'შესაბამისი მოთხოვნები'}>
    <nav className={styles.tabs} aria-label="შესაძლებლობები">
      {requestId ? <><Link href="/matching/">რეკომენდებული</Link><span aria-current="page">მომწოდებლები</span></> : <span aria-current="page">რეკომენდებული</span>}
      <Link href="/requests/">ყველა მოთხოვნა</Link>
    </nav>
    {!requestId && !me.verified && <EmptyState title="შეთავაზების გასაგზავნად საჭიროა ვერიფიკაცია" text="მოთხოვნების ნახვა უკვე შეგიძლიათ." action={<Button href="/onboarding/?step=verify" variant="secondary">ვერიფიკაცია</Button>}/>}
    <div className={styles.filters}><label>ქალაქი<CustomSelect aria-label="შესაბამისობის ქალაქი" value={city} onChange={event => { setCity(event.target.value); setOffset(0); }}><option value="">ყველა ქალაქი</option>{Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect></label>{!requestId && <label className={styles.check}><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)}/>მხოლოდ ვერიფიცირებული მყიდველი</label>}</div>
    {current?.error && <EmptyState title="სია ვერ ჩაიტვირთა" text={current.error} action={<Button variant="secondary" onClick={() => setRetry(value => value + 1)}>ხელახლა ცდა</Button>}/>}
    {items.length > 0 && <ul className={styles.grid}>{items.map(item => {
      const request = store?.getRequest(item.id);
      const profile = store?.userById(requestId ? item.id : request?.ownerId);
      return <li key={item.id}>{requestId ? <CompanyListingCard catalog c={{ id: item.id, name: item.company || profile?.company || '', industry: item.industry || '', city: item.city, verified: !!item.verified, logoUrl: profile?.logoUrl, about: profile?.about || '', offers: profile?.offers || [], serviceCities: profile?.serviceCities || [], stats: profile?.stats || { sent: 0, chosen: 0 } }}/> : request ? <OpportunityCard request={{ ...request, daysLeft: store?.daysLeft(request) }} buyer={profile ? { name: profile.company || profile.name, verified: !!profile.verified } : undefined} canOffer={!!me.verified}/> : <Link href={`/requests/view/?id=${item.id}`}>{item.title}</Link>}<p className={styles.reason}>კატეგორია ემთხვევა{item.score === 100 ? ' · ქალაქი ემთხვევა' : ''}</p></li>;
    })}</ul>}
    {loading ? <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/> : !current?.error && !items.length && <EmptyState icon="search" title={requestId ? 'შესაბამისი მომწოდებლები ჯერ არაა' : 'შესაბამისი მოთხოვნები ჯერ არაა'} text={verified ? 'ჩატვირთულ შედეგებში ვერიფიცირებული მყიდველი ვერ მოიძებნა.' : 'შედეგები კატეგორიისა და ქალაქის მიხედვით შეირჩევა.'} action={!requestId ? <Button variant="secondary" href="/onboarding/?step=provide">კატეგორიების შევსება</Button> : undefined}/>}
    {current?.more && !current.error && offset + matchingPageSize <= 10000 && <Button variant="secondary" disabled={loading} onClick={() => setOffset(value => value + matchingPageSize)}>მეტის ჩატვირთვა</Button>}
  </section>;
}
