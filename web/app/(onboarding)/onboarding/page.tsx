import { Suspense } from 'react';
import { OnboardPage, OnboardLoading } from '../../components/market/OnboardPage';
export default function Page() {
  return <Suspense fallback={<OnboardLoading />}><OnboardPage /></Suspense>;
}
