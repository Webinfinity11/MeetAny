import type { ReactNode } from "react";
import { Toasts } from "./components/Toasts";
import { ChatPopup } from "./components/market/ChatPopup";
import { NavigationProgress } from "./components/ProgressBar";
import { ThemeController } from "./components/ThemeController";
import { themeBootstrap } from "./lib/theme";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/primitives.css";
import "./styles/patterns.css";
import { siteIcons, siteViewport } from "./lib/site-metadata";

export const metadata = { icons: siteIcons };
export const viewport = siteViewport;

// One document for the marketplace: route changes preserve the authenticated store
// instead of reloading HTML, session, catalogs and scripts at each group boundary.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ka" data-theme="blue" suppressHydrationWarning><head><script id="meetany-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body className="ma"><ThemeController /><NavigationProgress />{children}<Toasts /><ChatPopup /></body></html>;
}
