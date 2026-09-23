import { connection } from "next/server";
import { loadPublicSnapshot } from "../../lib/public-snapshot";
import { Suspense } from "react";
import { RequestsPageContent } from "../../components/market/RequestsPageContent";

export default async function RequestsPage() {
  await connection();
  const initial = await loadPublicSnapshot();
  return (
    <Suspense>
      <RequestsPageContent initial={initial} />
    </Suspense>
  );
}
