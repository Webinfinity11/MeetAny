import type { Metadata, Viewport } from "next";
import "../styles/tokens.css";
import "../styles/market.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "MeetAny",
  description: "დაწერე, რა გჭირდება — კომპანიები თავად შემოგთავაზებენ ფასს და პირობებს.",
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
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ka">
      <body className="ma">
        <a className="ma-skip" href="#main">
          ძირითად შინაარსზე გადასვლა
        </a>
        <Header />
        <main id="main" className="ma-main" tabIndex={-1}>
          {children}
        </main>
        <Footer />
        <div className="ma-toasts" id="ma-toasts" aria-live="polite" aria-atomic="false" />
      </body>
    </html>
  );
}
