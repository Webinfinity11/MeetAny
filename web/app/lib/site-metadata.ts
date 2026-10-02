import type { Metadata, Viewport } from "next";

export const siteIcons: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico?v=meetany-20261002", sizes: "32x32" },
    { url: "/assets/favicon.png?v=meetany-20261002", sizes: "192x192", type: "image/png" },
  ],
  apple: "/assets/apple-touch-icon.png?v=meetany-20261002",
};

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
