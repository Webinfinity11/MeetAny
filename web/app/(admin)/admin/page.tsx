import { Suspense } from "react";
import { AdminPageContent } from "../../components/market/AdminPageContent";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageContent />
    </Suspense>
  );
}
