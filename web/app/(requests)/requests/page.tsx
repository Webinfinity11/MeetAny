import { Suspense } from "react";
import { RequestsPageContent } from "../../components/market/RequestsPageContent";

export default function RequestsPage() {
  return (
    <Suspense>
      <RequestsPageContent />
    </Suspense>
  );
}
