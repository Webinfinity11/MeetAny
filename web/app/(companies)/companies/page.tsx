import { Suspense } from "react";
import { CompaniesPageContent } from "../../components/market/CompaniesPageContent";

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompaniesPageContent />
    </Suspense>
  );
}
