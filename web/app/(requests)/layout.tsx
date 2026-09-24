import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/pages/catalog.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "მოთხოვნები — MeetAny",
  description: "ბიზნესის საჭიროებები: დადე განცხადება და მიიღე კომპანიების შეთავაზებები.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="requests">{children}</SiteShell>;
}
