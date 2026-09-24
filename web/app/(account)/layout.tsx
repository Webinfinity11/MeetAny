import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/pages/account.css";
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
