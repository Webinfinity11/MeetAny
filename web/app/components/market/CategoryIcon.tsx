import type { ReactNode } from "react";
import { groupOf } from "../../lib/categories";

// Soft sector silhouettes: few internal lines, curved corners, one 24-unit grid.
const drawings: Record<string, ReactNode> = {
  interior: <><path className="sector-fill" d="M6 11V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M6 14v-2a2 2 0 0 0-4 0v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-4 0v2H6Zm-1 4v2m14-2v2"/></>,
  construction: <><path className="sector-fill" d="M4 15a8 8 0 0 1 16 0"/><path d="M9 10V6a3 3 0 0 1 6 0v4M4 15h16a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4Z"/></>,
  food: <><path className="sector-fill" d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c-2-2 2-2 0-4m8 4c-2-2 2-2 0-4M8 20h8"/></>,
  production: <><rect className="sector-fill" x="4" y="5" width="16" height="15" rx="4"/><path d="M9 5v5l3-1 3 1V5M8 16h4"/></>,
  logistics: <><path className="sector-fill" d="M3 16V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9"/><path d="M15 10h3a2 2 0 0 1 1.7 1l2 3a2 2 0 0 1 .3 1v2h-2M3 17h1m4 0h8"/><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/></>,
  facility: <><path className="sector-fill" d="M12 3c-2 4-7 7-7 11a7 7 0 0 0 14 0c0-4-5-7-7-11Z"/><path d="M9 14a3 3 0 0 0 3 3"/></>,
  it: <><rect className="sector-fill" x="3" y="4" width="18" height="13" rx="4"/><path d="M12 17v4m-4 0h8"/></>,
  marketing: <><path className="sector-fill" d="M9 8 17 4a2 2 0 0 1 3 2v12a2 2 0 0 1-3 2l-8-4H6a4 4 0 0 1 0-8h3Z"/><path d="M9 8v8m-3 0 1 4a2 2 0 0 0 3 1"/></>,
  business: <><circle className="sector-fill" cx="10" cy="10" r="7"/><path d="M17 9a6 6 0 1 1-8 8M10 7v6m-2-4h4"/></>,
  tourism: <><rect className="sector-fill" x="4" y="7" width="16" height="14" rx="5"/><path d="M9 7V5a3 3 0 0 1 6 0v2m-3 5v4"/></>,
  trade: <><path className="sector-fill" d="M4 10h16l-1.5-5h-13L4 10Z"/><path d="M5 10v9h14v-9M10 19v-5h4v5"/></>,
  other: <><circle className="sector-fill" cx="7" cy="7" r="3.5"/><circle cx="17" cy="7" r="3.5"/><circle cx="7" cy="17" r="3.5"/><circle className="sector-fill" cx="17" cy="17" r="3.5"/></>,
};

export function CategoryIcon({ id }: { id: string }) {
  return <span className="sector-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{drawings[groupOf[id] || id] || drawings.other}</svg></span>;
}
