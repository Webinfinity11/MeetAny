import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // site/dist's URLs all carry a trailing slash (/requests/, /companies/, …); matching that
  // here keeps every href identical between the server-rendered HTML and the client, which a
  // mismatched convention was turning into hydration errors.
  trailingSlash: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
