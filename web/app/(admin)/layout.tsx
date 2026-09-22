import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "ადმინ-პანელი — MeetAny",
  description: "MeetAny-ს ადმინისტრირება.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="admin">{children}</SiteShell>;
}
