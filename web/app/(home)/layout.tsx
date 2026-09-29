import type { Metadata, Viewport } from "next";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/primitives.css";
import "../styles/patterns.css";
import "../styles/cards.css";
import "../styles/pages/homepage.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Toasts } from "../components/Toasts";

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
      <body className="ma ma-homepage">
        <a className="ma-skip" href="#main">
          ძირითად შინაარსზე გადასვლა
        </a>
        <div className="site-shell">
          <Header />
          <main id="main" className="home-page" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </div>
        <Toasts />
      </body>
    </html>
  );
}
