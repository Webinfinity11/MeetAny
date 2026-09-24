import { Suspense } from "react";
import { connection } from "next/server";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { CompanyProfilePageContent } from "../../../components/market/CompanyProfilePageContent";

// The public snapshot renders the profile — and whether it has a phone — on the server,
// so "ნომრის ნახვა" is in the first paint instead of after a client fetch.
export default async function CompanyViewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <CompanyProfilePageContent initial={initial} />
    </Suspense>
  );
}
