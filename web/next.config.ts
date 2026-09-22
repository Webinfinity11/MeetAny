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
};

export default nextConfig;
