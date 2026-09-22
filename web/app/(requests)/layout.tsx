import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import "../styles/proto.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "მოთხოვნები — MeetAny",
  description: "ბიზნესის საჭიროებები: დადე განცხადება და მიიღე კომპანიების შეთავაზებები ფასით.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="requests">{children}</SiteShell>;
}
