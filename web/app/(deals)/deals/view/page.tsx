import { DetailSkeleton } from "../../../components/market/Skeletons";
import { Suspense } from "react";
import { DealViewPageContent } from "../../../components/market/DealViewPageContent";
export default function Page() {
  return <Suspense fallback={<DetailSkeleton/>}><DealViewPageContent/></Suspense>;
}
