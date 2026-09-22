import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import "../styles/proto.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "კომპანიები — MeetAny",
  description:
    "MeetAny-ზე დარეგისტრირებული მომწოდებლები და მომსახურების კომპანიები: რას სთავაზობენ და სად მუშაობენ.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="companies">{children}</SiteShell>;
}
