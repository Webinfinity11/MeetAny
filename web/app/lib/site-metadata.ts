import type { Metadata, Viewport } from "next";

export const siteIcons: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico", sizes: "32x32" },
    { url: "/assets/favicon.png", sizes: "192x192", type: "image/png" },
  ],
  apple: "/assets/apple-touch-icon.png",
};

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
