import { connection } from "next/server";
import { loadPublicSnapshot } from "../../lib/public-snapshot";
import { CompaniesPageContent } from "../../components/market/CompaniesPageContent";

// No Suspense boundary: see (requests)/requests/page.tsx.
export default async function CompaniesPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return <CompaniesPageContent initial={initial} />;
}
