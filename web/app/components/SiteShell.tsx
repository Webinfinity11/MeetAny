import { Header } from "./Header";
import { Footer } from "./Footer";
import { Toasts } from "./Toasts";

// Shared marketplace shell; each route group uses the same aligned container.
export function SiteShell({
  dataMarketPage,
  dataOpen,
  proto = true,
  children,
}: {
  dataMarketPage: string;
  dataOpen?: string;
  // marketplace.css's home-visual-language rules (r2-band, r2-section-head, …) are scoped under
  // .ma-proto so they never leak onto the unmodified terms page, which doesn't load marketplace.css.
  proto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <html lang="ka">
      <body className={proto ? "ma ma-proto" : "ma"} data-market-page={dataMarketPage} data-open={dataOpen}>
        <a className="ma-skip" href="#main">
          ძირითად შინაარსზე გადასვლა
        </a>
        <Header />
        <main id="main" className="ma-main" tabIndex={-1}>
          <div className="ma-container">{children}</div>
        </main>
        <Footer />
        <Toasts />
      </body>
    </html>
  );
}
