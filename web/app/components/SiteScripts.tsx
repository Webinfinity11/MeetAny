import Script from "next/script";

// Loads the existing MeetAny client stack unchanged (site/dist/{...}.js). The home page still
// uses the full legacy bundle (company-details, app, market — unchanged look, per owner
// decision). The v2 marketplace pages (requests, companies, account, admin, terms) only need
// shell.js (header, menu, toasts, sign-in state) and market-store.js (data/auth) — their own
// React components replace market.js's DOM rendering, so loading it there would fight the
// React tree for the same containers.
export function SiteScripts({ home = false }: { home?: boolean }) {
  if (home) {
    return (
      <>
        <Script src="/company-details.js" strategy="beforeInteractive" />
        <Script src="/app.js" strategy="beforeInteractive" />
        <Script src="/shell.js" strategy="beforeInteractive" />
        <Script src="/config.js" strategy="beforeInteractive" />
        <Script src="/market-store.js" strategy="beforeInteractive" />
        <Script src="/market.js" strategy="beforeInteractive" />
        <Script src="/home.js" strategy="beforeInteractive" />
      </>
    );
  }
  return (
    <>
      <Script src="/shell.js" strategy="beforeInteractive" />
      <Script src="/config.js" strategy="beforeInteractive" />
      <Script src="/market-store.js" strategy="beforeInteractive" />
    </>
  );
}
