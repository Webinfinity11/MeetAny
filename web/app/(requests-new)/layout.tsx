import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/pages/catalog.css";
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
