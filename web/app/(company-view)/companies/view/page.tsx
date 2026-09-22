import { Suspense } from "react";
import { CompanyProfilePageContent } from "../../../components/market/CompanyProfilePageContent";

export default function CompanyViewPage() {
  return (
    <Suspense>
      <CompanyProfilePageContent />
    </Suspense>
  );
}
