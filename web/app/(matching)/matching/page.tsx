import { Suspense } from 'react';
import { MatchingPageContent } from '../../components/market/MatchingPageContent';
export default function Page() { return <Suspense fallback={<div className="ma-page" role="status">იტვირთება…</div>}><MatchingPageContent/></Suspense>; }
