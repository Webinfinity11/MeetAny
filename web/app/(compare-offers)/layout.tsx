import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import styles from "../components/market/deals.module.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";
export const metadata: Metadata = { title: "შეთავაზებების შედარება — MeetAny", icons: siteIcons, robots: { index: false, follow: false } };
export const viewport = siteViewport;
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={styles.surface}><SiteShell dataMarketPage="compare-offers">{children}</SiteShell></div>;
}
