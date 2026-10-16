import { Suspense, type ReactNode } from "react";
import { Toasts } from "./Toasts";
import { ChatPopup } from "./market/ChatPopup";
import { NavigationProgress } from "./ProgressBar";
import { ScrollReset } from "./ScrollReset";
import { ViewportInsets } from "./ViewportInsets";
import { sessionPreloadScript } from "../lib/auth-session-preload";

// All routes, including global-not-found, share the neutral palette and semantic status colors.
export function RootDocument({ children }: { children: ReactNode }) {
  const sessionPreload = sessionPreloadScript((process.env.NEON_AUTH_BASE_URL || "").trim());
  return <html lang="ka" data-theme="classic"><head>{sessionPreload ? <script id="meetany-session-preload" dangerouslySetInnerHTML={{ __html: sessionPreload }} /> : null}</head><body className="ma"><NavigationProgress /><Suspense fallback={null}><ScrollReset /></Suspense><ViewportInsets />{children}<Toasts /><ChatPopup /></body></html>;
}
