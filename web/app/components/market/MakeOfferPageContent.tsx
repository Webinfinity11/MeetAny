"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { OfferSentModal } from './modals/OfferSentModal';
import { Badge } from '../ui/Badge';
import { useMarketStore } from '../../lib/market-client';
import { useRequestDetail } from '../../lib/use-request-detail';
import { validRequestId } from '../../lib/matching-client';
import { ownOffer } from '../../lib/offer-terms-client';
import { cities, units } from '../../lib/categories';
import { dateShort } from '../../lib/format';
import { DetailSkeleton } from './Skeletons';
import { CompanyAvatar } from './CompanyAvatar';
import { SendOfferForm } from './SendOfferForm';
import { Button } from '../ui/Button';
import { budgetLabel } from './OpportunityCard';
import { Icon } from '../Icon';
import styles from './MakeOffer.module.css';

export function MakeOfferPageContent() {
  const params = useSearchParams();
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const requestId = params.get('requestId') || '';
  const { store, sessionReady, available } = useMarketStore();
  const detail = useRequestDetail(store, sessionReady, available, requestId);
  const me = sessionReady ? store?.currentUser() : null;
  const request = store?.getRequest(requestId);
  const buyer = request ? store?.userById(request.ownerId) : undefined;
  const offer = store ? ownOffer(store, requestId) : undefined;
  let message = '';
  let verification: { status: string; next: string; action?: string } | null = null;
  if (!validRequestId(requestId)) message = 'შეთავაზების გასაგზავნად აირჩიეთ მოთხოვნა.';
  else if (!sessionReady || (detail.loading && !request)) message = 'მოთხოვნა იტვირთება…';
  else if (!available || detail.error) message = 'მოთხოვნა ვერ ჩაიტვირთა. სცადეთ ხელახლა.';
  else if (!me) message = 'შეთავაზების გასაგზავნად შედით კომპანიის ანგარიშში.';
  else if (me.blocked) message = 'ანგარიში დაბლოკილია.';
  else if (me.role !== 'company') message = 'შეთავაზების გაგზავნა მხოლოდ კომპანიის ანგარიშიდანაა შესაძლებელი.';
  else if (!me.verified) {
    message = 'შეთავაზების გასაგზავნად კომპანია ვერიფიცირებული უნდა იყოს.';
    // Status and next step in place until onboarding exposes shared verification labels.
    verification = me.verificationDocumentsStatus === 'pending' ? { status: 'დოკუმენტები განიხილება', next: 'განხილვის შედეგს შეტყობინებით მიიღებთ. ამ დროს მოთხოვნების დათვალიერება და შენახვა შეგიძლიათ.' }
      : me.verificationDocumentsStatus === 'rejected' ? { status: 'დოკუმენტები დაბრუნდა', next: 'გადაამოწმეთ შენიშვნა და ატვირთეთ განახლებული დოკუმენტები.', action: 'დოკუმენტების განახლება' }
      : { status: 'დოკუმენტები არ გაგზავნილა', next: 'ატვირთეთ კომპანიის რეგისტრაციის დოკუმენტი. განხილვის შემდეგ შეთავაზებების გაგზავნა გაიხსნება.', action: 'დოკუმენტების ატვირთვა' };
  }
  else if (!request || request.hidden) message = 'მოთხოვნა მიუწვდომელია.';
  else if (request.ownerId === me.id) message = 'საკუთარ მოთხოვნაზე შეთავაზებას ვერ გააგზავნით.';
  else if (store?.requestState(request) !== 'open') message = 'მოთხოვნა აღარ არის ღია.';
  if (validRequestId(requestId) && (!sessionReady || (detail.loading && !request))) return <DetailSkeleton label="შეთავაზება იტვირთება…"/>;
  const requestHref = `/requests/view/?id=${requestId}`;
  const opportunitiesHref = me?.role === 'company' ? '/matching/' : '/requests/';
  const signInHref = `/account/?role=company&next=${encodeURIComponent(`/offers/new/?requestId=${requestId}`)}`;
  return <div className={`ma-page ${styles.page}`}><nav className={styles.breadcrumbs} aria-label="ნავიგაცია"><Link href={opportunitiesHref}>შესაძლებლობები</Link><span>/</span>{request ? <><Link href={requestHref}>{request.title}</Link><span>/</span></> : null}<span>შეთავაზების გაგზავნა</span></nav>
    {message ? <section className={styles.panel}><h1>შეთავაზების გაგზავნა</h1><p role="status">{message}</p>{verification ? <dl className={styles.verification}><div><dt>ვერიფიკაცია</dt><dd>{verification.status}</dd></div><div><dt>შემდეგი ნაბიჯი</dt><dd>{verification.next}</dd></div></dl> : null}{verification ? verification.action ? <Button href="/onboarding/?step=verify">{verification.action}</Button> : <Button href={opportunitiesHref} variant="secondary">მოთხოვნების ნახვა</Button> : detail.error ? <Button onClick={() => window.location.reload()}>ხელახლა ცდა</Button> : !me && sessionReady ? <Button href={signInHref}>შესვლა</Button> : request ? <Button href={requestHref} variant="secondary">მოთხოვნაზე დაბრუნება</Button> : <Button href={opportunitiesHref} variant="secondary">მოთხოვნების ნახვა</Button>}</section> : <div className={styles.layout}><section className={styles.panel}><h1>{offer ? 'შეთავაზების რედაქტირება' : 'შეთავაზების გაგზავნა'}</h1><details className={styles.requestSummary} open><summary>თქვენ პასუხობთ მოთხოვნას: {request.title}</summary><dl><div><dt>რაოდენობა</dt><dd>{request.quantity} {units[request.unit] || request.unit}</dd></div><div><dt>ქალაქი</dt><dd>{cities[request.city] || request.city}</dd></div><div><dt>ვადა</dt><dd>{dateShort(request.neededBy) || 'დასაზუსტებელია'}</dd></div>{budgetLabel(request) ? <div><dt>ბიუჯეტი</dt><dd>{budgetLabel(request)}</dd></div> : null}</dl><Link href={requestHref}>მოთხოვნის ნახვა</Link></details><SendOfferForm standalone key={`${me.id}:${requestId}`} requestId={requestId} existing={offer ? { ...offer, companyName: me.company, companyHref: `/companies/view/?id=${me.id}`, city: me.city, isNew: false } : undefined} onDone={editing => { if (editing) router.push(requestHref); else setSent(true); }} onCancel={() => router.push(requestHref)}/></section><aside className={styles.summary}><section className={styles.panel}><small>მყიდველი</small>{buyer?.company ? <div className={styles.buyer}><CompanyAvatar name={buyer.company} logoUrl={buyer.logoUrl}/><div><strong>{buyer.company}</strong>{buyer.verified ? <Badge status="success">ვერიფიცირებული</Badge> : null}<p>{cities[buyer.city] || buyer.city}</p></div></div> : null}</section>{!detail.loading && !detail.error ? <section className={styles.offerCount}><Icon name="inbox"/><span>{store?.offerCount(requestId) ? `მიღებულია ${store.offerCount(requestId)} შეთავაზება` : 'შეთავაზება ჯერ არ მიღებულა'}</span></section> : null}</aside></div>}
    <OfferSentModal open={sent} onClose={() => router.push(requestHref)}/>
  </div>;
}
