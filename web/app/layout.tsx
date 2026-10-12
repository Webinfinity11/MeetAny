import type { ReactNode } from "react";
import { Toasts } from "./components/Toasts";
import { ChatPopup } from "./components/market/ChatPopup";
import { NavigationProgress } from "./components/ProgressBar";
import { ThemeController } from "./components/ThemeController";
import { sessionPreloadScript } from "./lib/auth-session-preload";
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
  const sessionPreload = sessionPreloadScript((process.env.NEON_AUTH_BASE_URL || "").trim());
  return <html lang="ka" data-theme="blue" suppressHydrationWarning><head><script id="meetany-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />{sessionPreload ? <script id="meetany-session-preload" dangerouslySetInnerHTML={{ __html: sessionPreload }} /> : null}</head><body className="ma"><ThemeController /><NavigationProgress />{children}<Toasts /><ChatPopup /></body></html>;
}
