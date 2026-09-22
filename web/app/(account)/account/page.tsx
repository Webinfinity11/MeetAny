import { Suspense } from "react";
import { AccountPageContent } from "../../components/market/AccountPageContent";

export default function AccountPage() {
  return (
    <Suspense>
      <AccountPageContent />
    </Suspense>
  );
}
