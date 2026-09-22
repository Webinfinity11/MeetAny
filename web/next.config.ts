import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // site/dist's URLs all carry a trailing slash (/requests/, /companies/, …); matching that
  // here keeps every href identical between the server-rendered HTML and the client, which a
  // mismatched convention was turning into hydration errors.
  trailingSlash: true,
  // market-store.js's own fetch() calls to /api/db/... never carry a trailing slash; without
  // this they'd get a 308 redirect on every single request (real client-observed latency —
  // each store refresh() fires a dozen of these serially/in parallel).
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: __dirname,
  },
  // Mirrors site/vercel.json's redirects (the archived Design 01, the old /v2/ prefix,
  // /categories and the retired static company/request slugs). site/dist keeps its own copy
  // of this file for as long as it's still deployed; keep the two in sync by hand.
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
