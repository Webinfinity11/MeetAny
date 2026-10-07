"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMarketStore } from '../../lib/market-client';
import { useRequestDetail } from '../../lib/use-request-detail';
import { validRequestId } from '../../lib/matching-client';
import { ownOffer } from '../../lib/offer-terms-client';
import { cities, units } from '../../lib/categories';
import { dateLabel } from '../../lib/format';
import { DetailSkeleton } from './Skeletons';
import { CompanyAvatar } from './CompanyAvatar';
import { SendOfferForm } from './SendOfferForm';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import styles from './MakeOffer.module.css';

export function MakeOfferPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const requestId = params.get('requestId') || '';
  const { store, sessionReady, available } = useMarketStore();
  const detail = useRequestDetail(store, sessionReady, available, requestId);
  const me = sessionReady ? store?.currentUser() : null;
  const request = store?.getRequest(requestId);
  const buyer = request ? store?.userById(request.ownerId) : undefined;
  const offer = store ? ownOffer(store, requestId) : undefined;
  let message = '';
  if (!validRequestId(requestId)) message = 'შეთავაზების გასაგზავნად აირჩიეთ მოთხოვნა.';
  else if (!sessionReady || (detail.loading && !request)) message = 'მოთხოვნა იტვირთება…';
  else if (!available || detail.error) message = 'მოთხოვნა ვერ ჩაიტვირთა. სცადეთ ხელახლა.';
  else if (!me) message = 'შეთავაზების გასაგზავნად შედით კომპანიის ანგარიშში.';
  else if (me.blocked) message = 'ანგარიში დაბლოკილია.';
  else if (me.role !== 'company' || !me.verified) message = 'შეთავაზების გაგზავნა შეუძლია მხოლოდ დადასტურებულ კომპანიას.';
  else if (!request || request.hidden) message = 'მოთხოვნა მიუწვდომელია.';
  else if (request.ownerId === me.id) message = 'საკუთარ მოთხოვნაზე შეთავაზებას ვერ გააგზავნით.';
  else if (store?.requestState(request) !== 'open') message = 'მოთხოვნა აღარ არის ღია.';
  if (validRequestId(requestId) && (!sessionReady || (detail.loading && !request))) return <DetailSkeleton label="შეთავაზება იტვირთება…"/>;
  const requestHref = `/requests/view/?id=${requestId}`;
  return <div className={`ma-page ${styles.page}`}><nav className={styles.breadcrumbs} aria-label="ნავიგაცია"><Link href="/matching/">შესაძლებლობები</Link><span>/</span>{request ? <><Link href={requestHref}>{request.title}</Link><span>/</span></> : null}<span>შეთავაზება</span></nav>
    {message ? <section className={styles.panel}><h1>შეთავაზების გაგზავნა</h1><p role="status">{message}</p>{detail.error ? <Button onClick={() => window.location.reload()}>ხელახლა ცდა</Button> : !me && sessionReady ? <Button href="/account/">შესვლა</Button> : <Button href="/matching/" variant="secondary">შესაძლებლობები</Button>}</section> : <div className={styles.layout}><section className={styles.panel}><h1>{offer ? 'შეთავაზების რედაქტირება' : 'შეთავაზების გაგზავნა'}</h1><p className={styles.lead}>შეავსეთ მხოლოდ ის, რაც მყიდველს გადაწყვეტილებისთვის სჭირდება.</p><SendOfferForm key={`${me.id}:${requestId}`} requestId={requestId} existing={offer ? { ...offer, companyName: me.company, companyHref: `/companies/view/?id=${me.id}`, city: me.city, isNew: false } : undefined} onDone={() => router.push(requestHref)} onCancel={() => router.push(requestHref)}/></section><aside className={styles.summary}><section className={styles.panel}><small>თქვენ პასუხობთ მოთხოვნას</small><h2><Link href={requestHref}>{request.title}</Link></h2><dl>{request.quantity != null ? <div><dt><Icon name="package"/>რაოდენობა</dt><dd>{request.quantity} {units[request.unit]}</dd></div> : null}<div><dt><Icon name="map-pin"/>მიწოდება</dt><dd>{cities[request.city] || request.city}</dd></div>{request.neededBy ? <div><dt><Icon name="calendar"/>საჭიროა</dt><dd>{dateLabel(request.neededBy)}</dd></div> : null}</dl><p className={styles.requestBody}>{request.body}</p>{buyer?.company ? <div className={styles.buyer}><CompanyAvatar name={buyer.company} logoUrl={buyer.logoUrl}/><div><strong>{buyer.company}</strong><p>{cities[buyer.city] || buyer.city}</p></div></div> : null}</section><section className={styles.notice}><h2><Icon name="inbox"/>{store?.offerCount(requestId) ?? 0} შეთავაზება</h2><p>მყიდველი ადარებს ფასს, ვადას და პირობებს. მოკლე და ზუსტი აღწერა გადაწყვეტილებას ამარტივებს.</p></section></aside></div>}
  </div>;
}
