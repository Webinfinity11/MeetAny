import { Suspense } from "react";
import { RequestViewPageContent } from "../../../components/market/RequestViewPageContent";

export default function RequestViewPage() {
  return (
    <Suspense>
      <RequestViewPageContent />
    </Suspense>
  );
}
