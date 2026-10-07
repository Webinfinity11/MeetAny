"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sheet } from '../ui/Sheet';
import { ListSkeleton } from './Skeletons';
import { categoryPhoto, currentCategory } from '../../lib/categories';
import { useMarketStore } from '../../lib/market-client';
import { flowError, listMatching, matchingPageSize, type MatchingItem } from '../../lib/matching-client';
import { categories, cities, units } from '../../lib/categories';
import { Button } from '../ui/Button';
import { CustomSelect } from '../ui/CustomSelect';
import { Icon } from '../Icon';
import styles from './Matching.module.css';

export function MatchingFeed({ requestId, compact = false }: { requestId?: string; compact?: boolean }) {
  const { store, sessionReady, available } = useMarketStore();
  const me = sessionReady ? store?.currentUser() : null;
  const [city, setCity] = useState('');
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [result, setResult] = useState<{ key: string; items?: MatchingItem[]; error?: string }>();
  const allowed = !!me && !me.blocked && (!!requestId || (me.role === 'company' && me.verified));
  const callRpc = store?.callRpc;
  const key = JSON.stringify([me?.id, requestId, city, offset, retry, allowed]);
  useEffect(() => {
    let active = true;
    if (!allowed || !callRpc) return;
    void listMatching({ callRpc }, requestId || null, city, offset).then(items => { if (active) setResult({ key, items }); }, error => { if (active) setResult({ key, error: flowError(error) }); });
    return () => { active = false; };
  }, [allowed, callRpc, requestId, city, offset, key]);
  const current = result?.key === key ? result : undefined;
  if (!sessionReady) return <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/>;
  if (!available) return <p role="alert">სერვისი დროებით მიუწვდომელია.</p>;
  if (!me) return <div className={styles.empty}><h2>შედით ანგარიშში</h2><p>შესაბამისი შესაძლებლობები თქვენი პროფილით შეირჩევა.</p><Button href="/account/">შესვლა</Button></div>;
  if (!allowed) return <div className={styles.empty}><h2>შესაძლებლობები ჯერ მიუწვდომელია</h2><p>{me.blocked ? 'ანგარიში დაბლოკილია.' : 'მოთხოვნების პერსონალური სია ხელმისაწვდომია ადმინისტრატორის მიერ დადასტურებული კომპანიისთვის.'}</p><Button href="/onboarding/" variant="secondary">კომპანიის მონაცემები</Button><Button href="/account/?tab=requests" variant="ghost">ჩემი მოთხოვნები</Button></div>;
  const items = current?.items || [];
  const active = items.find(i => i.id === selected) || items[0];
  const title = (item: MatchingItem) => requestId ? item.company : item.title;
  const photo = (item: MatchingItem) => requestId ? store?.userById(item.id)?.logoUrl : store?.getRequest(item.id)?.photo || `/assets/photos/${categoryPhoto[currentCategory(item.category || 'other')] || 'workshop-banner.jpg'}`;
  const description = (item: MatchingItem) => requestId ? store?.userById(item.id)?.about : store?.getRequest(item.id)?.body;
  const ownerName = (item: MatchingItem) => { const request = !requestId && store?.getRequest(item.id); return request ? store?.userById(request.ownerId)?.company : undefined; };
  const activeRequest = active && !requestId ? store?.getRequest(active.id) : undefined;
  const detail = active ? <><div className={styles.detailPhoto}>{photo(active) ? <Image unoptimized src={photo(active)} alt="" width={320} height={150}/> : <Icon name="building-2"/>}</div><span className={styles.kind}>{requestId ? 'მომწოდებელი' : 'ყიდვის მოთხოვნა'}</span><h2>{title(active)}</h2>{description(active) ? <p className={styles.description}>{description(active)}</p> : null}{activeRequest?.quantity != null ? <p><Icon name="package"/>{activeRequest.quantity} {units[activeRequest.unit]}</p> : null}<p><Icon name="map-pin"/>{cities[active.city] || active.city}</p><Button href={requestId ? `/companies/view/?id=${active.id}` : `/offers/new/?requestId=${active.id}`}>{requestId ? 'კომპანიის ნახვა' : 'შეთავაზების გაგზავნა'}</Button>{!requestId ? <Link href={`/requests/view/?id=${active.id}`}>მოთხოვნის ნახვა</Link> : null}</> : null;
  return <section className={styles.feed} aria-label={requestId ? 'შესაბამისი მომწოდებლები' : 'შესაბამისი მოთხოვნები'}>
    <div className={styles.toolbar}><div><strong>{requestId ? 'მომწოდებლები' : 'ყიდვის მოთხოვნები'}</strong><p>შერჩეულია კატეგორიისა და ქალაქის მიხედვით</p></div><label>ქალაქი<CustomSelect aria-label="შესაბამისობის ქალაქი" value={city} onChange={e => { setCity(e.target.value); setOffset(0); setSelected(undefined); }}><option value="">ყველა ქალაქი</option>{Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect></label></div>
    {!current ? <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/> : current.error ? <div className={styles.empty} role="alert"><p>{current.error}</p><Button variant="secondary" onClick={() => setRetry(n => n + 1)}>ხელახლა ცდა</Button></div> : !items.length ? <div className={styles.empty}><Icon name="search"/><h2>შესაბამისი შედეგი ჯერ არ არის</h2><p>{requestId ? 'ამ მოთხოვნის კატეგორიით მომწოდებელი ვერ მოიძებნა.' : 'მოთხოვნები შეირჩევა პროფილში მითითებული მიწოდების კატეგორიებით.'}</p>{city ? <Button variant="secondary" onClick={() => { setCity(''); setOffset(0); }}>ქალაქის გასუფთავება</Button> : !requestId ? <Button variant="secondary" href="/onboarding/">კატეგორიების შევსება</Button> : null}</div> : <div className={compact ? styles.compact : styles.columns}>
      <ul className={styles.list}>{(compact ? items.slice(0, 4) : items).map(item => <li key={item.id}><Button variant="ghost" className={styles.card} aria-pressed={active?.id === item.id} onClick={() => { setSelected(item.id); if (window.matchMedia('(max-width:1199px)').matches || compact) setMobileOpen(true); }}><span className={styles.symbol}>{photo(item) ? <Image unoptimized src={photo(item)} alt="" width={120} height={92}/> : <Icon name="building-2"/>}</span><span className={styles.copy}><span className={styles.kind}>{requestId ? 'მომწოდებელი' : 'ყიდვის მოთხოვნა'}</span><strong>{title(item)}</strong>{description(item) ? <span className={styles.excerpt}>{description(item)}</span> : null}<span>{ownerName(item) ? <b>{ownerName(item)} · </b> : null}{cities[item.city] || item.city}{item.category ? ` · ${categories[item.category] || item.category}` : ''}</span></span></Button></li>)}</ul>
      {active && !compact ? <aside className={styles.detail}>{detail}</aside> : null}
    </div>}
    <Sheet open={mobileOpen && !!active} onClose={() => setMobileOpen(false)} title={active ? title(active) : "შესაძლებლობა"}><div className={styles.sheetDetail}>{detail}</div></Sheet>
    {compact ? <Button href="/matching/" variant="secondary">ყველა შესაძლებლობა</Button> : <nav className={styles.pagination} aria-label="შედეგების გვერდები"><Button variant="secondary" disabled={offset === 0 || !current} onClick={() => { setOffset(n => Math.max(0, n - matchingPageSize)); setSelected(undefined); }}>წინა</Button><span>გვერდი {offset / matchingPageSize + 1}</span><Button variant="secondary" disabled={!current?.items || items.length < matchingPageSize || offset + matchingPageSize > 10000} onClick={() => { setOffset(n => n + matchingPageSize); setSelected(undefined); }}>შემდეგი</Button></nav>}
  </section>;
}
