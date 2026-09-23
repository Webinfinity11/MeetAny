import type { ReactNode } from "react";

// MeetAny sector pictograms: one 32-unit construction grid, ink outlines and blue planes.
const drawings: Record<string, ReactNode> = {
  furniture: <><path className="sector-plane" d="M5 16h22v9H5z"/><path d="M8 16V9h16v7M5 14v11h22V14M5 20h22M8 25v4m16-4v4M11 9v7m10-7v7"/></>,
  construction: <><path className="sector-plane" d="M7 12h13v16H7z"/><path d="M4 28h25M7 28V9h13v19m0-12h7v12M11 13h5m-5 5h5m-5 5h5M6 6h15M24 20v3"/></>,
  textiles: <><path className="sector-plane" d="M10 5h12v23H10z"/><path d="M9 5h14v23H9zM12 5v23m8-23v23M6 9h20M6 24h20M15 9v15m2-15v15M9 28v2m7-2v2m7-2v2"/></>,
  food: <><path className="sector-plane" d="M5 17h22v10H5z"/><path d="M5 17h22l-2 11H7zM9 17l3-11m1 11 3-10m1 10 5-11M8 22h16M6 12l4-2m7 1 5 2M11 4l2 2m8-2 2 2"/></>,
  packaging: <><path className="sector-plane" d="m16 14 12-6v17l-12 6z"/><path d="m4 8 12-5 12 5v17l-12 5-12-5zM4 8l12 6 12-6M16 14v16M10 6l12 6v6M7 22l5 2"/></>,
  logistics: <><path className="sector-plane" d="M3 8h17v16H3z"/><path d="M3 8h17v16H3zM20 14h5l4 5v5h-9M23 14v6h6M4 12h10M3 16h8"/><circle cx="9" cy="25" r="3"/><circle cx="24" cy="25" r="3"/></>,
  cleaning: <><path className="sector-plane" d="M9 13h12v16H9z"/><path d="M9 13h12v16H9zM12 13V9h7v4M13 9V5h10l3 4M19 5v4M12 20h6m-6 4h6M26 13v4m-2-2h4"/></>,
  technology: <><path className="sector-plane" d="M4 5h24v17H4z"/><path d="M4 5h24v17H4zM4 18h24M12 28h8m-4-6v6M13 9l-3 3 3 3m6-6 3 3-3 3"/></>,
  marketing: <><path className="sector-plane" d="m9 12 16-7v18L9 17z"/><path d="m9 12 16-7v18L9 17H4v-5zM9 17l3 10h5l-3-8M25 10h3m-1-7 2-2m-2 22 2 2"/></>,
  finance: <><path className="sector-plane" d="M7 3h18v26H7z"/><path d="M7 3h18v26H7zM11 7h10v6H11zM11 18h2m6 0h2m-10 5h2m6 0h2"/></>,
  legal: <><path className="sector-plane" d="M5 17h9l-2 5H7zm13 0h9l-2 5h-5z"/><path d="M16 5v23M10 28h12M6 9h20M9 9l-4 8h9L9 9m14 0-5 8h9l-4-8M5 17c0 7 9 7 9 0m4 0c0 7 9 7 9 0"/><circle cx="16" cy="5" r="2"/></>,
  tourism: <><path className="sector-plane" d="M6 10h20v18H6z"/><path d="M6 10h20v18H6zM12 10V5h8v5M10 10v18m12-18v18M10 29v1m12-1v1M14 17h4v5h-4z"/></>,
  other: <><path className="sector-plane" d="M4 4h10v10H4zm14 14h10v10H18z"/><path d="M4 4h10v10H4zm14 0h10v10H18zM4 18h10v10H4zm14 0h10v10H18z"/></>,
};

export function CategoryIcon({ id }: { id: string }) {
  return <span className="sector-icon" aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false">{drawings[id] || drawings.other}</svg></span>;
}
