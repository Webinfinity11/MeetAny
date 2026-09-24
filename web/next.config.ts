import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The browser talks to Neon Auth directly (market-store.js config.authUrl); the env value wins,
// the auth-probe host is the fallback so a missing env var never blocks sign-in.
const AUTH_FALLBACK = "https://ep-withered-glade-b54ts1g5.neonauth.c-7.us-east-2.aws.neon.tech";
function origin(url: string | undefined) {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}
const authOrigins = [...new Set([origin(process.env.NEON_AUTH_BASE_URL), AUTH_FALLBACK].filter(Boolean))];

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
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
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
