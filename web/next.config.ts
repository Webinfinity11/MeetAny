import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Vercel serves HTTPS. A local `next start` is plain HTTP, where WebKit applies the upgrade
// to localhost too and every stylesheet and script fails to load.
const isVercel = !!process.env.VERCEL;

// One public Auth URL drives both the browser bundle and CSP. Rebuild when changing environments.
const authBaseUrl = (process.env.NEON_AUTH_BASE_URL || "").trim().replace(/\/+$/, "");
const authOrigins = authBaseUrl ? [new URL(authBaseUrl).origin] : [];

// No nonces (pages stay static-capable): App Router's inline bootstrap scripts need 'unsafe-inline';
// 'unsafe-eval' and the HMR websocket are dev-only. Photos come from Vercel Blob; client uploads
// go to vercel.com/api/blob and then to the store host.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  `connect-src 'self' ${authOrigins.join(" ")} https://vercel.com/api/blob/ https://*.blob.vercel-storage.com${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_NEON_AUTH_BASE_URL: authBaseUrl },
  poweredByHeader: false,
  // Several root layouts (one per route group), so unmatched URLs need app/global-not-found.tsx.
  experimental: {
    globalNotFound: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Preserve the published URLs and avoid redirects for API fetches.
  trailingSlash: true,
  // market-store.js's own fetch() calls to /api/db/... never carry a trailing slash; without
  // this they'd get a 308 redirect on every single request (real client-observed latency —
  // each store refresh() fires a dozen of these serially/in parallel).
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: __dirname,
  },
  // Historical published links continue to resolve to the current catalog.
  async redirects() {
    return [
      { source: "/v1", destination: "/", permanent: false },
      { source: "/v1/:path*", destination: "/", permanent: false },
      { source: "/v2", destination: "/", permanent: true },
      // skipTrailingSlashRedirect (above) means Next won't add the trailing slash back onto a
      // wildcard-substituted destination on its own, so it's spelled out here explicitly.
      { source: "/v2/:path*", destination: "/:path*/", permanent: true },
      { source: "/categories", destination: "/companies/", permanent: false },
      { source: "/categories/", destination: "/companies/", permanent: false },
      {
        source:
          "/companies/:slug(accord-legal|axis-build|balance-partners|bridge-distribution|clear-space|forma-studio|fresh-market|linen-house|pack-and-co|pixel-works|route-logistics|stay-collective)",
        destination: "/companies/",
        permanent: false,
      },
      {
        source: "/requests/:slug(1000-chairs|branded-boxes|concrete-m300|hotel-booking-website|hotel-linen-200|post-renovation-cleaning|tbilisi-batumi-cargo|weekly-produce)",
        destination: "/requests/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
