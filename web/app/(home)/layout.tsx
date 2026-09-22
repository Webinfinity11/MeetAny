import type { Metadata, Viewport } from "next";
import "../styles/tokens.css";
import "../styles/home.css";
import "../styles/market.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "MeetAny — იპოვე შენი ბიზნესპარტნიორი",
  description: "აღწერე ბიზნესსაჭიროება, აღმოაჩინე შესაბამისი კომპანია და დაიწყე საქმიანი კავშირი.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/assets/favicon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body className="design-two">
        <a className="skip-link" href="#main">
          ძირითად შინაარსზე გადასვლა
        </a>
        <div className="site-shell">
          <Header />
          <main id="main" className="home-page">
            {children}
          </main>
          <Footer />
        </div>
        <div className="ma-toasts" id="ma-toasts" aria-live="polite" aria-atomic="false" />
      </body>
    </html>
  );
}
