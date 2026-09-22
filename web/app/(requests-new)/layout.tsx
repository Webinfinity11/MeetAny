import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import "../styles/marketplace.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "მოთხოვნის დამატება — MeetAny",
  description: "დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ ფასს და პირობებს.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function RequestsNewLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell dataMarketPage="requests" dataOpen="new-request">
      {children}
    </SiteShell>
  );
}
