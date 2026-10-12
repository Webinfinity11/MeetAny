// next/image may resize only our own assets and uploaded Blob photos (next.config images).
// Anything else (blob:/data: previews, legacy external URLs) is passed through unoptimized.
const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
export const optimizable = (src?: string | null) => !!src && (BLOB.test(src) || (src.startsWith("/assets/") && !src.endsWith(".svg")));
