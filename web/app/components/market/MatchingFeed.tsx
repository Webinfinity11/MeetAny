"use client";
import { FullMatchingFeed, type FeedKind } from './matching/FullMatchingFeed';

export function MatchingFeed({ requestId, compact = false, kind, onCount }: { requestId?: string; compact?: boolean; kind?: FeedKind; onCount?: (count: number) => void }) {
  return <FullMatchingFeed requestId={requestId} compact={compact} kind={kind} onCount={onCount}/>;
}
