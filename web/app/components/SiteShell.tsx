import { Header } from "./Header";
import { Footer } from "./Footer";
import { SiteScripts } from "./SiteScripts";

// The shared root layout body for every generated page (requests, companies, account, admin,
// terms) — same shell.html structure the site/dist pages use. Each of these pages is its own
// Next.js root layout group (see app/(requests)/, app/(companies)/, …) so that navigating
// between them is a full page load and market.js's page-keyed renderers[] re-run from scratch,
// exactly like the static site.
export function SiteShell({
  dataMarketPage,
  dataOpen,
  children,
}: {
  dataMarketPage: string;
  dataOpen?: string;
  children: React.ReactNode;
}) {
  return (
    <html lang="ka">
      <body className="ma" data-market-page={dataMarketPage} data-open={dataOpen}>
        <a className="ma-skip" href="#main">
          ძირითად შინაარსზე გადასვლა
        </a>
        <Header />
        <main id="main" className="ma-main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <div className="ma-toasts" id="ma-toasts" aria-live="polite" aria-atomic="false" />
        <SiteScripts />
      </body>
    </html>
  );
}
