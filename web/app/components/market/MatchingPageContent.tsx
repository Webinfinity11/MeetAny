"use client";
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MatchingFeed } from './MatchingFeed';
import { validRequestId } from '../../lib/matching-client';
import styles from './Matching.module.css';

export function MatchingPageContent() {
  const params = useSearchParams();
  const requestId = params.get('requestId') || undefined;
  return <div className={`ma-page ${styles.page}`}><aside className={styles.nav}><Link href="/account/?tab=overview">ჩემი ანგარიში</Link><Link href="/account/?tab=requests">ჩემი მოთხოვნები</Link><Link href="/matching/" aria-current={!requestId ? 'page' : undefined}>შესაძლებლობები</Link><Link href="/onboarding/">კომპანიის მონაცემები</Link></aside><div className={styles.main}><header><h1>{requestId ? 'შესაბამისი მომწოდებლები' : 'თქვენთვის შერჩეული'}</h1><p>{requestId ? 'კომპანიები ამ მოთხოვნის კატეგორიისა და ქალაქის მიხედვით.' : 'ღია მოთხოვნები თქვენი კომპანიის მიწოდების კატეგორიებით.'}</p></header>{requestId && !validRequestId(requestId) ? <p role="alert">მოთხოვნის მისამართი არასწორია.</p> : <MatchingFeed key={requestId || 'feed'} requestId={requestId}/>}</div></div>;
}
