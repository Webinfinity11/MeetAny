import type { Metadata } from "next";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/patterns.css";
import { RootDocument } from "./components/RootDocument";
import { SiteShell } from "./components/SiteShell";
import { NotFoundBody } from "./components/StatusPage";
import { siteIcons, siteViewport } from "./lib/site-metadata";

// Unmatched URLs land here (experimental.globalNotFound) outside every layout, so this page brings
// its own document — the same RootDocument as layout.tsx (theme, body.ma, fonts) — and the same shell.
export const metadata: Metadata = {
  title: "გვერდი ვერ მოიძებნა — MeetAny",
  description: "ეს გვერდი MeetAny-ზე არ არსებობს.",
  icons: siteIcons,
};

export const viewport = siteViewport;

export default function GlobalNotFound() {
  return (
    <RootDocument>
      <SiteShell dataMarketPage="not-found">
        <NotFoundBody />
      </SiteShell>
    </RootDocument>
  );
}
