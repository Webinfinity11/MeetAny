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
import { verificationLabel } from '../../lib/onboarding-client';
import { dateShort } from '../../lib/format';
import { DetailSkeleton } from './Skeletons';
import { CompanyAvatar } from './CompanyAvatar';
import { SendOfferForm } from './SendOfferForm';
import { Button } from '../ui/Button';
import { FormLayout } from '../ui/FormLayout';
import { money } from '../../lib/deal-client';
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
  if (!validRequestId(requestId)) message = 'შეთავაზების გასაგზავნად აირჩიეთ მოთხოვნა.';
  else if (!sessionReady || (detail.loading && !request)) message = 'მოთხოვნა იტვირთება…';
  else if (!available || detail.error) message = 'მოთხოვნა ვერ ჩაიტვირთა. სცადეთ ხელახლა.';
  else if (!me) message = 'შეთავაზების გასაგზავნად შედით ანგარიშში.';
  else if (me.blocked) message = 'ანგარიში დაბლოკილია.';
  else if (!['client', 'company'].includes(me.role)) message = 'ამ ანგარიშიდან შეთავაზება მიუწვდომელია.';
  else if (!request || request.hidden) message = 'მოთხოვნა მიუწვდომელია.';
  else if (request.ownerId === me.id) message = 'საკუთარ მოთხოვნაზე შეთავაზებას ვერ გააგზავნით.';
  else if (store?.requestState(request) !== 'open') message = 'მოთხოვნა აღარ არის ღია.';
  if (validRequestId(requestId) && (!sessionReady || (detail.loading && !request))) return <DetailSkeleton label="შეთავაზება იტვირთება…"/>;
  const requestHref = `/requests/view/?id=${requestId}`;
  const opportunitiesHref = me?.role === 'company' ? '/matching/' : '/requests/';
  const signInHref = `/account/?${new URLSearchParams({ next: `/offers/new/?requestId=${requestId}`, intent: 'offer', context: request?.title || '' })}`;
  return <div className={`ma-page ${styles.page}`}><nav className={styles.breadcrumbs} aria-label="ნავიგაცია"><Link href={opportunitiesHref}>შესაძლებლობები</Link><span>/</span>{request ? <><Link href={requestHref} className={styles.requestCrumb}><span>{request.title}</span><span className={styles.mobileCrumb}>‹ მოთხოვნა</span></Link><span>/</span></> : null}<span>შეთავაზების გაგზავნა</span></nav>
    {message ? <section className={styles.panel}><h1>შეთავაზების გაგზავნა</h1><p role="status">{message}</p>{detail.error ? <Button onClick={() => window.location.reload()}>ხელახლა ცდა</Button> : !me && sessionReady ? <Button href={signInHref}>შესვლა</Button> : request ? <Button href={requestHref} variant="secondary">მოთხოვნაზე დაბრუნება</Button> : <Button href={opportunitiesHref} variant="secondary">მოთხოვნების ნახვა</Button>}</section> : <SendOfferForm standalone formId="make-offer-form" key={`${me.id}:${requestId}`} requestId={requestId}
      existing={offer ? { ...offer, companyName: me.company, companyHref: me.role === 'company' ? `/companies/view/?id=${me.id}` : '', city: me.city, isNew: false } : undefined}
      onDone={editing => { if (editing) router.push(requestHref); else setSent(true); }} onCancel={() => router.push(requestHref)}
      renderLayout={(form, state) => {
        const price = state.values.priceType === 'negotiable' ? 'ფასი შეთანხმებით' : state.total == null ? 'ფასი დასაზუსტებელია' : money(state.total);
        const delivery = state.values.deliveryDays ? `${state.values.deliveryDays} დღე` : 'ვადა შეთანხმებით';
        const submit = <Button type="submit" form="make-offer-form" loading={state.pending} disabled={state.submitDisabled}>{state.submitLabel}</Button>;
        return <FormLayout className={styles.layout} title={offer ? 'შეთავაზების რედაქტირება' : 'შეთავაზების გაგზავნა'}
          subtitle={<Link className={styles.navigationLink} href={requestHref}>მოთხოვნა: {request.title}</Link>} asideLabel="მოთხოვნა და შეთავაზების წინასწარი ხედი"
          aside={<>
            <section className={styles.panel} aria-label="მოთხოვნის შეჯამება">
              <h2><Link className={styles.navigationLink} href={requestHref}>{request.title}</Link></h2>
              <dl className={styles.summaryFacts}>
                <div><dt><Icon name="map-pin"/>ქალაქი</dt><dd>{cities[request.city] || request.city}</dd></div>
                <div><dt><Icon name="package"/>რაოდენობა</dt><dd>{request.quantity ? `${request.quantity} ${units[request.unit] || request.unit}` : 'დასაზუსტებელია'}</dd></div>
                <div><dt><Icon name="calendar"/>ვადა</dt><dd>{dateShort(request.neededBy) || 'დასაზუსტებელია'}</dd></div>
                {budgetLabel(request) ? <div><dt><Icon name="wallet"/>ბიუჯეტი</dt><dd>{budgetLabel(request)}</dd></div> : null}
              </dl>
              {buyer ? <div className={styles.buyer}><CompanyAvatar name={buyer.company || buyer.name} logoUrl={buyer.logoUrl}/><div><small>მყიდველი</small><strong>{buyer.company || buyer.name}</strong>{buyer.verified ? <Badge status="success">{verificationLabel(buyer.verificationDocumentsStatus, buyer.verified)}</Badge> : null}</div></div> : null}
              {!detail.loading && !detail.error ? <p className={styles.offerCount}><Icon name="inbox"/><span>{store?.offerCount(requestId) ? `მიღებულია ${store.offerCount(requestId)} შეთავაზება` : 'შეთავაზება ჯერ არ მიღებულა'}</span></p> : null}
            </section>
            <section className={`${styles.panel} ${styles.preview}`} aria-label="შეთავაზების წინასწარი ხედი">
              <h2>ასე ნახავს კლიენტი</h2>
              <dl className={styles.previewFacts}><div><dt>ჯამური ფასი</dt><dd>{price}</dd></div><div><dt>შესრულების ვადა</dt><dd>{delivery}</dd></div></dl>
              <p className={styles.previewBody}>{state.values.body.trim().split('\n')[0] || 'აქ გამოჩნდება თქვენი შეთავაზების მოკლე აღწერა.'}</p>
            </section>
            <Link className={`${styles.returnLink} ${styles.navigationLink}`} href={requestHref} aria-disabled={state.pending || state.fileBusy || undefined} onClick={event => { if (state.pending || state.fileBusy) event.preventDefault(); }}>მოთხოვნაზე დაბრუნება</Link>
          </>}
          footer={<div className={styles.footerActions}><span>{price} · {delivery}</span>{submit}</div>}>
          <section className={styles.panel}>{form}</section>
        </FormLayout>;
      }}/>}
    <OfferSentModal open={sent} onClose={() => router.push(requestHref)}/>
  </div>;
}
