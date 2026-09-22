import { Suspense } from "react";
import { RequestsPageContent } from "../../../components/market/RequestsPageContent";

export default function RequestsNewPage() {
  return (
    <Suspense>
      <RequestsPageContent autoOpenNew />
    </Suspense>
  );
}
