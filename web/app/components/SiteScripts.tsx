import Script from "next/script";

// Loads the existing MeetAny client stack unchanged (site/dist/{company-details,app,shell,config,
// market-store,market}.js), in the same order the generated pages use (scripts/generate-market.cjs).
// market.js depends on app.js's globals (icon, esc) and reads document.body.dataset.marketPage at
// its own execution time, so these must run before hydration and in this exact order.
export function SiteScripts({ home = false }: { home?: boolean }) {
  return (
    <>
      <Script src="/company-details.js" strategy="beforeInteractive" />
      <Script src="/app.js" strategy="beforeInteractive" />
      <Script src="/shell.js" strategy="beforeInteractive" />
      <Script src="/config.js" strategy="beforeInteractive" />
      <Script src="/market-store.js" strategy="beforeInteractive" />
      <Script src="/market.js" strategy="beforeInteractive" />
      {home ? <Script src="/home.js" strategy="beforeInteractive" /> : null}
    </>
  );
}
