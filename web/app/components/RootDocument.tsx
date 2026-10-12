import { Suspense, type ReactNode } from "react";
import { Toasts } from "./Toasts";
import { ChatPopup } from "./market/ChatPopup";
import { NavigationProgress } from "./ProgressBar";
import { ScrollReset } from "./ScrollReset";
import { ThemeController } from "./ThemeController";
import { ViewportInsets } from "./ViewportInsets";
import { sessionPreloadScript } from "../lib/auth-session-preload";
import { themeBootstrap } from "../lib/theme";

// The one <html>/<body> for every route, including global-not-found: same theme attribute and
// bootstrap, body.ma (fonts, margins), toasts and navigation progress — a 404 is not another site.
export function RootDocument({ children }: { children: ReactNode }) {
  const sessionPreload = sessionPreloadScript((process.env.NEON_AUTH_BASE_URL || "").trim());
  return <html lang="ka" data-theme="blue" suppressHydrationWarning><head><script id="meetany-theme" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />{sessionPreload ? <script id="meetany-session-preload" dangerouslySetInnerHTML={{ __html: sessionPreload }} /> : null}</head><body className="ma"><ThemeController /><NavigationProgress /><Suspense fallback={null}><ScrollReset /></Suspense><ViewportInsets />{children}<Toasts /><ChatPopup /></body></html>;
}
