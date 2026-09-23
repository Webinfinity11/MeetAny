import { connection } from "next/server";
import { loadPublicSnapshot } from "../../lib/public-snapshot";
import { Suspense } from "react";
import { CompaniesPageContent } from "../../components/market/CompaniesPageContent";

export default async function CompaniesPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <CompaniesPageContent initial={initial} />
    </Suspense>
  );
}
