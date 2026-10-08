"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../Icon';
import { CompanyAvatar } from '../CompanyAvatar';
import { SaveCompanyButton } from '../SaveCompanyButton';
import { categoryPhoto, currentCategory, units } from '../../../lib/categories';
import { dateLabel, postedLabel } from '../../../lib/format';
import catalogStyles from '../catalog/Catalog.module.css';
import { useMarketStore } from '../../../lib/market-client';
import { flowError, listMatching, matchingPageSize, validRequestId, type MatchingItem } from '../../../lib/matching-client';
import { cities } from '../../../lib/categories';
import { Button } from '../../ui/Button';
import { CustomSelect } from '../../ui/CustomSelect';
import { EmptyState } from '../../ui/Structure';
import { ListSkeleton } from '../Skeletons';
import styles from '../Matching.module.css';

export function FullMatchingFeed({ requestId, onCount }: { requestId?: string; onCount?: (count: number) => void }) {
  const { store, ready, sessionReady, available } = useMarketStore();
  const me = sessionReady ? store?.currentUser() : null;
  const target = requestId && validRequestId(requestId) ? store?.getRequest(requestId) : null;
  const own = !!target && target.ownerId === me?.id;
  const closed = own && (target.hidden || store?.requestState(target) !== 'open');
  const allowed = !closed && ready && !!me && !me.blocked && (requestId ? own : me.role === 'company');
  const city = '';
  const [tab, setTab] = useState(requestId ? 'suppliers' : 'recommended');
  const [sort, setSort] = useState('newest');
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<string>();
  const [mobileOpen, setMobileOpen] = useState(false);
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
  const current = result?.scope === scope ? result : undefined;
  const count = allowed ? current?.items.length || 0 : 0;
  useEffect(() => { onCount?.(count); }, [count, onCount]);
  if (!ready || !sessionReady) return <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/>;
  if (!available) return <EmptyState title="სერვისი დროებით მიუწვდომელია" text="სცადეთ მოგვიანებით."/>;
  if (!me) return <EmptyState title="შედით ანგარიშში" text="შესაბამისი შესაძლებლობები თქვენი პროფილით შეირჩევა." action={<Button href="/account/">შესვლა</Button>}/>;
  if (me.blocked) return <EmptyState title="ანგარიში დაბლოკილია" text="შესაძლებლობები მიუწვდომელია."/>;
  if (requestId && !own) return <EmptyState title="მოთხოვნა ვერ მოიძებნა" text="აირჩიეთ თქვენი მოთხოვნა მომწოდებლების სანახავად." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (closed) return <EmptyState title="მოთხოვნა აღარ არის ღია" text="მომწოდებლების შესარჩევად აირჩიეთ აქტიური მოთხოვნა." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (!allowed) return <EmptyState title="აირჩიეთ თქვენი მოთხოვნა" text="შესაბამისი მომწოდებლები მოთხოვნის კატეგორიით შეირჩევა." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  const loading = current?.key !== key;
  const suppliersUnavailable = tab === 'suppliers' && !requestId;
  const items = (current?.items || []).filter(item => !verified || (requestId ? item.verified : store?.userById(store?.getRequest(item.id)?.ownerId)?.verified)).sort((a, b) => {
    const left = requestId ? store?.userById(a.id) : store?.getRequest(a.id);
    const right = requestId ? store?.userById(b.id) : store?.getRequest(b.id);
    if (sort === 'deadline' && !requestId) return (Date.parse(left?.neededBy || left?.expiresAt) || Infinity) - (Date.parse(right?.neededBy || right?.expiresAt) || Infinity);
    return (Date.parse(b.created_at || right?.createdAt) || 0) - (Date.parse(a.created_at || left?.createdAt) || 0);
  });
  const active = items.find(item => item.id === selected) || items[0];
  const request = active && !requestId ? store?.getRequest(active.id) : null;
  const identity = active ? store?.userById(requestId ? active.id : request?.ownerId) : null;
  const title = (item: MatchingItem) => (requestId ? item.company : item.title) || 'შესაძლებლობა';
  const photo = (item: MatchingItem): string | undefined => requestId ? store?.userById(item.id)?.logoUrl : store?.getRequest(item.id)?.photo || `/assets/photos/${categoryPhoto[currentCategory(item.category || 'other')] || 'workshop-banner.jpg'}`;
  const description = (item: MatchingItem): string | undefined => requestId ? store?.userById(item.id)?.about : store?.getRequest(item.id)?.body;
  const kind = <span className={styles.kind} data-tone={requestId ? 'info' : 'success'}>{requestId ? 'მომწოდებელი' : 'ყიდვის მოთხოვნა'}</span>;
  const detail = active ? <>
    <div className={styles.detailPhoto}>{photo(active) ? <Image unoptimized src={photo(active)!} alt="" width={300} height={188}/> : <Icon name="building-2"/>}</div>
    {kind}<h2>{title(active)}</h2>
    <ul className={styles.facts}>
      {request?.quantity != null && <li><Icon name="check"/>{request.quantity} {units[request.unit]}</li>}
      {description(active) && <li><Icon name="check"/>{description(active)}</li>}
      <li><Icon name="check"/>{cities[active.city] || active.city}</li>
      {request?.neededBy && <li><Icon name="check"/>მიწოდება: {dateLabel(request.neededBy)}</li>}
    </ul>
    {identity && <div className={styles.identity}><CompanyAvatar name={identity.company || identity.name || 'მომხმარებელი'} logoUrl={identity.logoUrl}/><div><strong>{identity.company || identity.name}</strong><p>{cities[identity.city] || identity.city}</p></div>{identity.verified && <span title="ვერიფიცირებული"><Icon name="badge-check"/></span>}</div>}
    <Button href={requestId ? `/companies/view/?id=${encodeURIComponent(active.id)}` : `/offers/new/?requestId=${encodeURIComponent(active.id)}`}><Icon name={requestId ? 'building-2' : 'send'}/>{requestId ? 'კომპანიის ნახვა' : 'შეთავაზების გაგზავნა'}</Button>
    {requestId && <SaveCompanyButton id={active.id}/>}
  </> : null;
  return <section className={`${styles.feed} ${styles.fullFeed}`} aria-label={requestId ? 'შესაბამისი მომწოდებლები' : 'შესაბამისი მოთხოვნები'}>
    <div className={styles.feedToolbar}>
      <nav className={styles.tabs} aria-label="შესაძლებლობები">{[['recommended', 'რეკომენდებული'], ['requests', 'ყიდვის მოთხოვნები'], ['suppliers', 'მომწოდებლები']].map(([value, text]) => requestId && value !== 'suppliers' ? <Button key={value} variant="ghost" href="/matching/">{text}</Button> : <button key={value} type="button" aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setMobileOpen(false); }}>{text}</button>)}</nav>
      <div className={styles.feedControls}><label className={catalogStyles.requestVerified}><input type="checkbox" role="switch" checked={verified} onChange={event => setVerified(event.target.checked)}/><span className={catalogStyles.switchTrack} aria-hidden="true"/><span>ვერიფიცირებული</span></label><CustomSelect aria-label="დალაგება" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">უახლესი</option>{!requestId && <option value="deadline">ვადა ახლოს</option>}</CustomSelect></div>
    </div>
    {!requestId && !me.verified && <EmptyState title="შეთავაზების გასაგზავნად საჭიროა ვერიფიკაცია" text="მოთხოვნების ნახვა უკვე შეგიძლიათ." action={<Button href="/onboarding/?step=verify" variant="secondary">ვერიფიკაცია</Button>}/>}
    {suppliersUnavailable ? <EmptyState icon="building-2" title="მომწოდებლების რეკომენდაციები მალე" text="ამ ეტაპზე მომწოდებლების შერჩევა შეგიძლიათ თქვენი მოთხოვნიდან." action={<Button href="/account/?tab=requests" variant="secondary">ჩემი მოთხოვნები</Button>}/> : <>
      {current?.error && <EmptyState title="სია ვერ ჩაიტვირთა" text={current.error} action={<Button variant="secondary" onClick={() => setRetry(value => value + 1)}>ხელახლა ცდა</Button>}/>}
      {!!items.length && <div className={styles.columns}><ul className={styles.list}>{items.map(item => {
        const req = !requestId ? store?.getRequest(item.id) : null;
        const owner = store?.userById(requestId ? item.id : req?.ownerId);
        const created = item.created_at || req?.createdAt || owner?.createdAt;
        return <li key={item.id}><button type="button" className={styles.card} aria-pressed={item.id === active?.id} onClick={() => { setSelected(item.id); if (matchMedia('(max-width:999px)').matches) setMobileOpen(true); }}>
          <span className={styles.symbol}>{photo(item) ? <Image unoptimized src={photo(item)!} alt="" width={100} height={76}/> : <Icon name="building-2"/>}</span>
          <span className={styles.copy}>{kind}<strong>{title(item)}</strong>{description(item) && <span className={styles.excerpt}>{description(item)}</span>}<span className={styles.cardMeta}>{[owner?.company || owner?.name, cities[item.city] || item.city, created ? postedLabel(created, now) : null].filter(Boolean).join(' · ')}</span></span>
        </button></li>;
      })}</ul><aside className={styles.detail} aria-label="შესაძლებლობის დეტალი">{detail}</aside></div>}
      {loading ? <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/> : !current?.error && !items.length && <EmptyState icon="search" title={requestId ? 'შესაბამისი მომწოდებლები ჯერ არაა' : 'შესაბამისი მოთხოვნები ჯერ არაა'} text={verified ? 'ჩატვირთულ შედეგებში ვერიფიცირებული კომპანია ვერ მოიძებნა.' : 'შედეგები კატეგორიისა და ქალაქის მიხედვით შეირჩევა.'} action={!requestId ? <Button variant="secondary" href="/onboarding/?step=provide">კატეგორიების შევსება</Button> : undefined}/>}
      {current?.more && !current.error && offset + matchingPageSize <= 10000 && <Button variant="secondary" disabled={loading} onClick={() => setOffset(value => value + matchingPageSize)}>მეტის ჩატვირთვა</Button>}
      <Sheet open={mobileOpen && !!active} onClose={() => setMobileOpen(false)} title={active ? title(active) : 'შესაძლებლობა'}><div className={`${styles.sheetDetail} ${styles.fullDetail}`}>{detail}</div></Sheet>
    </>}
  </section>;
}
