import { Suspense } from 'react';
import { MakeOfferPageContent } from '../../../components/market/MakeOfferPageContent';
export default function Page() { return <Suspense fallback={<div className="ma-page" role="status">იტვირთება…</div>}><MakeOfferPageContent/></Suspense>; }
