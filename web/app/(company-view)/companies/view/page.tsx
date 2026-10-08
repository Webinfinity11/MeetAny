import { Suspense } from "react";
import { connection } from "next/server";
import { loadPublicSnapshot } from "../../../lib/public-snapshot";
import { CompanyProfilePageContent } from "../../../components/market/CompanyProfilePageContent";

// Use the same public snapshot for SSR and the first client render.
export default async function CompanyViewPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <CompanyProfilePageContent initial={initial} />
    </Suspense>
  );
}
