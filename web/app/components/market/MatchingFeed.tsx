"use client";
import { FullMatchingFeed } from './matching/FullMatchingFeed';

export function MatchingFeed({ requestId, compact = false, onCount }: { requestId?: string; compact?: boolean; onCount?: (count: number) => void }) {
  return <FullMatchingFeed requestId={requestId} compact={compact} onCount={onCount}/>;
}
