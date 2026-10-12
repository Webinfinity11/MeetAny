import type { ReactNode } from "react";
import { RootDocument } from "./components/RootDocument";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/patterns.css";
import { siteIcons, siteViewport } from "./lib/site-metadata";

export const metadata = { icons: siteIcons };
// resizes-content: Android shrinks the layout with the keyboard, so sticky/fixed bars stay above it.
export const viewport = { ...siteViewport, interactiveWidget: "resizes-content" as const };

// One document for the marketplace: route changes preserve the authenticated store
// instead of reloading HTML, session, catalogs and scripts at each group boundary.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <RootDocument>{children}</RootDocument>;
}
