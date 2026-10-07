import styles from '../components/market/Matching.module.css';
import type { Metadata } from 'next';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/primitives.css';
import '../styles/patterns.css';
import { SiteShell } from '../components/SiteShell';
import { siteIcons, siteViewport } from '../lib/site-metadata';
export const metadata: Metadata = { title: 'თქვენთვის შერჩეული — MeetAny', robots: { index: false, follow: false }, icons: siteIcons };
export const viewport = siteViewport;
export default function Layout({ children }: { children: React.ReactNode }) { return <SiteShell dataMarketPage="matching"><div className={styles.canvas}>{children}</div></SiteShell>; }
