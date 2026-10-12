import type { Metadata } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/pages/ideas.css";
import { SiteShell } from "../components/SiteShell";
import { siteIcons, siteViewport } from "../lib/site-metadata";
// Business Ideas are outside the MVP: the pages stay reachable by old links but are not indexed (and not in the sitemap).
export const metadata:Metadata={title:"ბიზნესიდეები — MeetAny",description:"პრაქტიკული ბიზნესიდეები, პირველი ნაბიჯები და საჭირო მომწოდებლების მოძიება.",icons:siteIcons,robots:{index:false,follow:true}};
export const viewport=siteViewport;
export default function Layout({children}:{children:React.ReactNode}){return <SiteShell dataMarketPage="ideas">{children}</SiteShell>;}
