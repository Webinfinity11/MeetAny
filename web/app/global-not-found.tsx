import type { Metadata } from "next";
import "./styles/tokens.css";
import "./styles/market.css";
import "./styles/marketplace.css";
import { SiteShell } from "./components/SiteShell";
import { NotFoundBody } from "./components/StatusPage";
import { siteIcons, siteViewport } from "./lib/site-metadata";

// Every route group is its own root layout, so unmatched URLs land here (experimental.globalNotFound)
// and rebuild the same shell: header, footer, tokens.
export const metadata: Metadata = {
  title: "გვერდი ვერ მოიძებნა — MeetAny",
  description: "ეს გვერდი MeetAny-ზე არ არსებობს.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <SiteShell dataMarketPage="not-found">
      <NotFoundBody />
    </SiteShell>
  );
}
