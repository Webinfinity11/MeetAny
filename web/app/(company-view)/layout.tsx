import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import "../styles/proto.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "კომპანია — MeetAny",
  description: "კომპანიის პროფილი MeetAny-ზე.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function CompanyViewLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="company">{children}</SiteShell>;
}
