import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "წესები და კონფიდენციალურობა — MeetAny",
  description: "MeetAny-ს გამოყენების წესები და პერსონალური მონაცემების დამუშავება.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell dataMarketPage="terms" proto={false}>
      {children}
    </SiteShell>
  );
}
