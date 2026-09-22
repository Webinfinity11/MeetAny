import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import "../styles/proto.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";

export const metadata: Metadata = {
  title: "ჩემი ანგარიში — MeetAny",
  description: "შესვლა, რეგისტრაცია, ჩემი განცხადებები, შეთავაზებები და კომპანიის პროფილი.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell dataMarketPage="account">{children}</SiteShell>;
}
