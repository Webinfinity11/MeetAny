"use client";
import { useState } from "react";
import { DuoIcon } from "../ui/DuoIcon";

// One tap = one result: a row filters, and a group's categories open under it while the group or
// one of them is selected (no separate chevron). Rows with no results are hidden — they would only
// lead to an empty list — except the selected one. Long lists show the busiest groups first.
export type Facet = { id: string; label: string; count: number; icon?: string; children?: Facet[] };

const VISIBLE = 8;

export function FacetList({
  all,
  loading = false,
  allLabel,
  allCount,
  activeId,
  onSelect,
}: {
  all: Facet[];
  loading?: boolean;
  allLabel: string;
  allCount: number;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [more, setMore] = useState(false);
  const isActive = (f: Facet) => f.id === activeId || !!f.children?.some(c => c.id === activeId);
  const rows = [...all].sort((a, b) => b.count - a.count).filter(f => loading || f.count > 0 || isActive(f));
  // The selected group always stays visible, even when it falls outside the first rows.
  const shown = more || rows.length <= VISIBLE + 1 ? rows : rows.filter((f, i) => i < VISIBLE || isActive(f));
  const hidden = rows.length - shown.length;

  const row = (f: Facet, child = false) => (
    <button
      key={f.id}
      type="button"
      className={`catalog-facet${child ? " catalog-facet--child" : ""}`}
      aria-pressed={activeId === f.id}
      onClick={() => onSelect(f.id)}
    >
      {child ? null : <DuoIcon name={f.icon || (f.id ? "shapes" : "layout-grid")} size={18} className="catalog-facet__icon" />}
      <span className="catalog-facet__label">{f.label}</span>
      <span className="catalog-facet__count">{!loading && f.count >= 0 ? f.count : ""}</span>
    </button>
  );

  return (
    <div className="catalog-facets">
      {row({ id: "", label: allLabel, count: allCount })}
      {shown.map(f => {
        const children = (f.children || []).filter(c => loading || c.count > 0 || c.id === activeId);
        const open = isActive(f) && (children.length > 1 || children.some(c => c.id === activeId));
        return <div key={f.id} className="catalog-facet-group">
          {row(f)}
          {open ? <div className="catalog-facet__children" role="group" aria-label={f.label}>{children.map(c => row(c, true))}</div> : null}
        </div>;
      })}
      {hidden > 0 || (more && rows.length > VISIBLE + 1) ? (
        <button type="button" className="catalog-facet-more" aria-expanded={more} onClick={() => setMore(m => !m)}>
          {more ? "ნაკლების ჩვენება" : `კიდევ ${hidden}`}
        </button>
      ) : null}
    </div>
  );
}
