import { ListSkeleton } from "../../../components/market/Skeletons";
import { Suspense } from "react";
import { CompareOffersPageContent } from "../../../components/market/CompareOffersPageContent";
export default function Page() {
  return <Suspense fallback={<ListSkeleton/>}><CompareOffersPageContent/></Suspense>;
}
