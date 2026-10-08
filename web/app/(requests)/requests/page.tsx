import { connection } from "next/server";
import { loadPublicSnapshot } from "../../lib/public-snapshot";
import { RequestsPageContent } from "../../components/market/RequestsPageContent";

// No Suspense boundary: the page is dynamic and the snapshot is awaited above, so the list
// ships inside the initial HTML instead of a streamed boundary that hidden webviews (no
// requestAnimationFrame) never reveal.
export default async function RequestsPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  // Dynamic server clock is serialized once for identical SSR and hydration deadlines.
  // eslint-disable-next-line react-hooks/purity
  return <RequestsPageContent initial={initial} initialNow={Date.now()} />;
}
