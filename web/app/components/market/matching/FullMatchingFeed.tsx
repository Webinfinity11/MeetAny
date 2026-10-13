"use client";
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '../../ui/Badge';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../Icon';
import { CompanyAvatar, companyImage } from '../CompanyAvatar';
import { SaveCompanyButton } from '../SaveCompanyButton';
import { categories, categoryPhoto, currentCategory, units, cities } from '../../../lib/categories';
import { dateLabel, postedLabel } from '../../../lib/format';
import catalogStyles from '../catalog/Catalog.module.css';
import accountStyles from '../account/account.module.css';
import { useMarketStore } from '../../../lib/market-client';
import { flowError, listMatching, matchingPageSize, validRequestId, type MatchingItem } from '../../../lib/matching-client';
import { verificationLabel, verificationHint } from '../../../lib/onboarding-client';
import { Button } from '../../ui/Button';
import { CustomSelect } from '../../ui/CustomSelect';
import { EmptyState } from '../../ui/Structure';
import { Notice } from '../../ui/Notice';
import { ListSkeleton } from '../Skeletons';
import styles from '../Matching.module.css';

type FeedItem = MatchingItem & { kind: 'request' | 'supplier' };
export type FeedKind = 'recommended' | 'requests' | 'suppliers';
const itemKey = (item: FeedItem) => `${item.kind}:${item.id}`;

/** Feed picture; a missing or failed one falls back to the company avatar instead of a broken image. */
function FeedPhoto({ src, name, width, height }: { src?: string; name: string; width: number; height: number }) {
  const [failed, setFailed] = useState<string>();
  return src && src !== failed ? <Image unoptimized src={src} alt="" width={width} height={height} onError={() => setFailed(src)}/> : <CompanyAvatar name={name} size="xl"/>;
}

export function FullMatchingFeed({ requestId, compact = false, kind, onCount }: { requestId?: string; compact?: boolean; kind?: FeedKind; onCount?: (count: number) => void }) {
  const { store, ready, sessionReady, available } = useMarketStore();
  const me = sessionReady ? store?.currentUser() : null;
  const target = requestId && validRequestId(requestId) ? store?.getRequest(requestId) : null;
  const own = !!target && target.ownerId === me?.id;
  const closed = own && (target.hidden || store?.requestState(target) !== 'open');
  const allowed = !closed && ready && !!me && !me.blocked && me.role !== 'admin' && (!requestId || own);
  const [dismissed, setDismissed] = useState<Record<string, string[]>>(() => {
    try { const parsed = JSON.parse(localStorage.getItem('meetany.dismissedMatching') || '{}'); return parsed && typeof parsed === 'object' ? Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(id => typeof id === 'string'))) : {}; } catch { return {}; }
  });
  const hidden = dismissed[me?.id || ''] || [];
  const updateHidden = (ids: string[]) => {
    if (!me) return;
    const next = { ...dismissed, [me.id]: ids };
    setDismissed(next);
    try { localStorage.setItem('meetany.dismissedMatching', JSON.stringify(next)); } catch { /* Keep this session usable when storage is unavailable. */ }
  };
  const [city, setCity] = useState('');
  const [tab, setTab] = useState<FeedKind>(requestId ? 'suppliers' : kind || 'recommended');
  const [sort, setSort] = useState('recommended');
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<string>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [verified, setVerified] = useState(false);
  const [offset, setOffset] = useState(0);
  const [retry, setRetry] = useState(0);
  const limit = compact ? 4 : matchingPageSize;
  const scope = JSON.stringify([me?.id, requestId, tab, city, allowed, compact]);
  const key = JSON.stringify([scope, offset, retry]);
  const [result, setResult] = useState<{ scope: string; key: string; items: FeedItem[]; more: boolean; error?: string }>();
  const callRpc = store?.callRpc;
  useEffect(() => {
    if (!allowed || !callRpc) return;
    let active = true;
    const load: Promise<FeedItem[]> = requestId
      ? listMatching({ callRpc }, requestId, city, offset).then(page => page.map(item => ({ ...item, kind: 'supplier' as const })))
      : callRpc('list_matching_feed', { p_kind: tab, p_city: city || null, p_limit: limit, p_offset: offset });
    void load.then(page => {
      if (!Array.isArray(page)) throw new Error('Invalid matching response');
      if (active) setResult(previous => ({ scope, key, items: [...new Map([...(offset && previous?.scope === scope ? previous.items : []), ...page].map(item => [itemKey(item), item])).values()], more: page.length === (requestId ? matchingPageSize : limit) }));
    }).catch(error => {
      if (active) setResult(previous => ({ scope, key, items: previous?.scope === scope ? previous.items : [], more: true, error: flowError(error) }));
    });
    return () => { active = false; };
  }, [allowed, callRpc, requestId, tab, city, offset, scope, key, limit]);
  const current = result?.scope === scope ? result : undefined;
  const count = allowed ? current?.items.length || 0 : 0;
  useEffect(() => { onCount?.(count); }, [count, onCount]);
  if (!ready || !sessionReady) return <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/>;
  if (!available) return <EmptyState title="სერვისი დროებით მიუწვდომელია" text="სცადეთ მოგვიანებით."/>;
  if (!me) return <EmptyState title="შედით ანგარიშში" text="შესაბამისი შესაძლებლობები თქვენი პროფილით შეირჩევა." action={<Button href="/account/">შესვლა</Button>}/>;
  if (me.blocked) return <EmptyState title="ანგარიში დაბლოკილია" text="შესაძლებლობები მიუწვდომელია."/>;
  if (requestId && !own) return <EmptyState title="მოთხოვნა ვერ მოიძებნა" text="აირჩიეთ თქვენი მოთხოვნა მომწოდებლების სანახავად." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (closed) return <EmptyState title="მოთხოვნა აღარ არის ღია" text="მომწოდებლების შესარჩევად აირჩიეთ აქტიური მოთხოვნა." action={<Button href="/account/?tab=requests">ჩემი მოთხოვნები</Button>}/>;
  if (!allowed) return <EmptyState title="შესაძლებლობები მიუწვდომელია" text="გააგრძელეთ თქვენი პირადი ან კომპანიის ანგარიშით." action={<Button href="/account/">ჩემი ანგარიში</Button>}/>;
  const loading = current?.key !== key;
  const supplier = (item: FeedItem) => item.kind === 'supplier';
  const requestFor = (item: FeedItem) => supplier(item) ? null : store?.getRequest(item.id);
  const ownerFor = (item: FeedItem) => store?.userById(supplier(item) ? item.id : requestFor(item)?.ownerId);
  const createdFor = (item: FeedItem) => item.created_at || requestFor(item)?.createdAt || ownerFor(item)?.createdAt;
  const items = (current?.items || []).filter(item => !hidden.includes(itemKey(item)) && (!verified || item.verified || ownerFor(item)?.verified)).sort((a, b) => {
    if (sort === 'recommended') return (b.score || 0) - (a.score || 0);
    if (sort === 'deadline') return (Date.parse(requestFor(a)?.neededBy || requestFor(a)?.expiresAt) || Infinity) - (Date.parse(requestFor(b)?.neededBy || requestFor(b)?.expiresAt) || Infinity);
    return (Date.parse(createdFor(b)) || 0) - (Date.parse(createdFor(a)) || 0);
  });
  const active = items.find(item => itemKey(item) === selected) || items[0];
  const title = (item: FeedItem) => (supplier(item) ? item.company || item.title : item.title) || 'შესაძლებლობა';
  const photo = (item: FeedItem): string | undefined => supplier(item) ? companyImage(title(item), ownerFor(item)?.logoUrl, ownerFor(item)?.gallery) || undefined : requestFor(item)?.photo || `/assets/photos/${categoryPhoto[currentCategory(item.category || 'other')] || 'workshop-banner.jpg'}`;
  // A company without any picture shows its avatar, never an empty grey box.
  const visual = (item: FeedItem, width: number, height: number) => <FeedPhoto src={photo(item)} name={title(item)} width={width} height={height}/>;
  const description = (item: FeedItem): string | undefined => supplier(item) ? ownerFor(item)?.about : requestFor(item)?.body;
  // A supplier from a neighbouring direction of the same group (list_matching match='similar') says so.
  const badge = (item: FeedItem) => <><Badge className={styles.kind} status={supplier(item) ? 'info' : 'success'}>{supplier(item) ? 'მომწოდებელი' : 'ყიდვის მოთხოვნა'}</Badge>{item.match === 'similar' ? <Badge className={styles.kind} status="muted">მსგავსი მიმართულება</Badge> : null}</>;
  const viewHref = (item: FeedItem) => `/${supplier(item) ? 'companies' : 'requests'}/view/?id=${encodeURIComponent(item.id)}`;
  const actionHref = (item: FeedItem) => supplier(item) ? viewHref(item) : me.role === 'company' ? (me.verified ? `/offers/new/?requestId=${encodeURIComponent(item.id)}` : '/onboarding/?step=verify') : '/account/?tab=profile#company-upgrade';
  const actionLabel = (item: FeedItem) => supplier(item) ? 'კომპანიის ნახვა' : me.role !== 'company' ? 'კომპანიის პროფილის შექმნა' : me.verified ? 'შეთავაზების გაგზავნა' : 'ვერიფიკაციის გავლა';
  // A supplier card names the company in its title; the line under it says what it does and where.
  const meta = (item: FeedItem) => (supplier(item) ? [categories[item.industry || item.category || ''], cities[item.city] || item.city] : [item.company || ownerFor(item)?.company || ownerFor(item)?.name, cities[item.city] || item.city, createdFor(item) ? postedLabel(createdFor(item), now) : null]).filter(Boolean).join(' · ');
  const request = active ? requestFor(active) : null;
  const identity = active ? ownerFor(active) : null;
  const detail = active ? <>
    <div className={styles.detailPhoto}>{visual(active, 300, 188)}</div>
    {badge(active)}<h2>{title(active)}</h2>
    <ul className={styles.facts}>
      {request?.quantity != null && <li><Icon name="package"/>{request.quantity} {units[request.unit]}</li>}
      {description(active) && <li><Icon name="check"/>{description(active)}</li>}
      <li><Icon name="map-pin"/>{cities[active.city] || active.city}</li>
      {(active.category || active.industry) && <li><Icon name="check"/>{categories[active.category || active.industry || ''] || active.category || active.industry}</li>}
      {request?.neededBy && <li><Icon name="calendar"/>მიწოდება: {dateLabel(request.neededBy)}</li>}
    </ul>
    {(identity || active.company) && <div className={styles.identity}><CompanyAvatar name={identity?.company || identity?.name || active.company || title(active)} logoUrl={identity?.logoUrl}/><div><strong>{identity?.company || identity?.name || active.company}</strong><p>{cities[active.city] || active.city}</p></div>{(identity?.verified || active.verified) && <span title={verificationHint(identity?.verificationDocumentsStatus, !!(identity?.verified || active.verified))} aria-label={verificationLabel(identity?.verificationDocumentsStatus, !!(identity?.verified || active.verified))}><Icon name="badge-check"/></span>}</div>}
    <Button href={actionHref(active)}><Icon name={supplier(active) ? 'building-2' : 'send'}/>{actionLabel(active)}</Button>
    {supplier(active) ? <><Button variant="secondary" href={`/requests/new/?category=${encodeURIComponent(active.industry || active.category || '')}&company=${encodeURIComponent(active.id)}`}>ფასის მოთხოვნა</Button><SaveCompanyButton id={active.id}/></> : <Button variant="secondary" href={viewHref(active)}>მოთხოვნის ნახვა</Button>}
    <Button variant="ghost" onClick={() => { updateHidden([...hidden, itemKey(active)]); setMobileOpen(false); }}>არ მაინტერესებს</Button>
  </> : null;
  const reset = () => { setOffset(0); setSelected(undefined); setMobileOpen(false); };
  return <section className={`${styles.feed} ${styles.fullFeed}`} aria-label="თქვენთვის შერჩეული შესაძლებლობები">
    {!compact && <div className={styles.feedToolbar}>
      <nav className={styles.tabs} style={{ maxWidth: "100%" }} aria-label="შესაძლებლობები">{(requestId ? [['suppliers', 'მომწოდებლები']] : [['recommended', 'რეკომენდებული'], ['requests', 'ყიდვის მოთხოვნები'], ['suppliers', 'მომწოდებლები']]).map(([value, text]) => <Button variant="ghost" key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value as FeedKind); setSort('recommended'); reset(); }}>{text}</Button>)}</nav>
      <div className={styles.feedControls} style={{ flexWrap: "wrap" }}><label className={catalogStyles.requestVerified}><input type="checkbox" role="switch" checked={verified} onChange={event => setVerified(event.target.checked)}/><span className={catalogStyles.switchTrack} aria-hidden="true"/><span>ვერიფიცირებული</span></label><CustomSelect aria-label="ქალაქი" value={city} onChange={event => { setCity(event.target.value); reset(); }}><option value="">ყველა ქალაქი</option>{Object.entries(cities).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</CustomSelect><CustomSelect aria-label="დალაგება" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">შესაბამისობით</option><option value="newest">უახლესი</option>{tab === 'requests' && !requestId && <option value="deadline">ვადა ახლოს</option>}</CustomSelect></div>
    </div>}
    {me.role === 'company' && !me.verified && <Notice><strong>{verificationLabel(me.verificationDocumentsStatus, me.verified)}</strong> — {verificationHint(me.verificationDocumentsStatus, me.verified)}</Notice>}
    {current?.error && <Notice tone="error" action={<Button variant="secondary" size="sm" onClick={() => setRetry(value => value + 1)}>ხელახლა ცდა</Button>}>სია ვერ ჩაიტვირთა. {current.error}</Notice>}
    {!compact && !loading && me.role === 'company' && tab === 'recommended' && !!items.length && items.every(supplier) ? <Notice action={<Button variant="secondary" size="sm" href="/onboarding/?step=provide">მიწოდების მითითება</Button>}>მოთხოვნები რეკომენდებულში გამოჩნდება, როცა მიუთითებთ, რას აწვდით.</Notice> : null}
    {!!items.length && (compact ? <ul className={accountStyles.matchGrid}>{items.slice(0, 4).map(item => <li key={itemKey(item)} className={accountStyles.matchCard}>
      <span className={accountStyles.matchPhoto}>{visual(item, 80, 80)}</span><div className={accountStyles.matchCopy}>{badge(item)}<h3><Link className={accountStyles.cardLink} href={viewHref(item)}>{title(item)}</Link></h3><p>{meta(item)}</p><div className={accountStyles.matchFooter}><span><Icon name="sparkles"/>{categories[item.category || item.industry || ''] || 'თქვენი პროფილის მიხედვით'}</span><Link href={actionHref(item)}>{actionLabel(item)}</Link></div></div>
    </li>)}</ul> : <div className={styles.columns}><ul className={styles.list}>{items.map(item => <li key={itemKey(item)}><Button variant="ghost" className={styles.card} aria-pressed={itemKey(item) === (active && itemKey(active))} onClick={() => { setSelected(itemKey(item)); if (matchMedia('(max-width:999px)').matches) setMobileOpen(true); }}>
      <span className={styles.symbol}>{visual(item, 100, 76)}</span><span className={styles.copy}>{badge(item)}<strong>{title(item)}</strong>{description(item) && <span className={styles.excerpt}>{description(item)}</span>}<span className={styles.cardMeta}>{meta(item)}</span></span>
    </Button></li>)}</ul><aside className={styles.detail} aria-label="შესაძლებლობის დეტალი">{detail}</aside></div>)}
    {loading ? <ListSkeleton compact label="შესაძლებლობები იტვირთება…"/> : !current?.error && !items.length && <EmptyState icon="search" title="შესაბამისი შედეგები ჯერ არ არის" text={verified ? 'ჩატვირთულ შედეგებში ვერიფიცირებული კომპანია ვერ მოიძებნა.' : 'შეავსეთ ინტერესები და საქმიანობის კატეგორიები ან შეცვალეთ ქალაქი.'} action={city ? <Button variant="secondary" onClick={() => { setCity(''); reset(); }}>ქალაქის გასუფთავება</Button> : <Button variant="secondary" href={me.role === 'company' ? '/onboarding/?step=type' : '/account/?tab=profile'}>პროფილის შევსება</Button>}/>}
    {!!hidden.length && <Button variant="ghost" onClick={() => updateHidden([])}>დამალული შესაძლებლობების აღდგენა ({hidden.length})</Button>}
    {!compact && current?.more && !current.error && offset + matchingPageSize <= 10000 && <Button variant="secondary" disabled={loading} onClick={() => setOffset(value => value + matchingPageSize)}>მეტის ჩატვირთვა</Button>}
    {!compact && <Sheet open={mobileOpen && !!active} onClose={() => setMobileOpen(false)} title={active ? title(active) : 'შესაძლებლობა'}><div className={`${styles.sheetDetail} ${styles.fullDetail}`}>{detail}</div></Sheet>}
  </section>;
}
