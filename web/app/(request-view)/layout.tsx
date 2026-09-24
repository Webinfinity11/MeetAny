import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/pages/detail.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "მოთხოვნა — MeetAny",
  description: "განცხადება და შეთავაზებები MeetAny-ზე.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function RequestViewLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="request">{children}</SiteShell>;
}
