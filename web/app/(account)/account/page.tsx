import { AccountSkeleton } from "../../components/market/Skeletons";
import { Suspense } from "react";
import { AccountPageContent } from "../../components/market/AccountPageContent";

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <AccountPageContent />
    </Suspense>
  );
}
