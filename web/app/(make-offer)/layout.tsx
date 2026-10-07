import styles from '../components/market/MakeOffer.module.css';
import type { Metadata } from 'next';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/patterns.css';
import { SiteShell } from '../components/SiteShell';
import { siteIcons, siteViewport } from '../lib/site-metadata';
export const metadata: Metadata = { title: 'შეთავაზების გაგზავნა — MeetAny', robots: { index: false, follow: false }, icons: siteIcons };
export const viewport = siteViewport;
export default function Layout({ children }: { children: React.ReactNode }) { return <SiteShell dataMarketPage="make-offer"><div className={styles.canvas}>{children}</div></SiteShell>; }
