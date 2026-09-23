import { connection } from "next/server";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { RequestsPageContent } from "../../../components/market/RequestsPageContent";

// No Suspense boundary: see (requests)/requests/page.tsx.
export default async function RequestsNewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return <RequestsPageContent initial={initial} autoOpenNew />;
}
