"use client";
import { useState } from "react";
import { DuoIcon } from "../ui/DuoIcon";
import { Icon } from "../Icon";


// A group facet may carry its categories. They open under it while the group or one of them is
// selected, or when the person expands the group with its chevron (without filtering).
export type Facet = { id: string; label: string; count: number; icon?: string; children?: Facet[] };

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const sorted = [...all].sort((a, b) => b.count - a.count);
  // Industries with no companies sit at the end in compact 32px rows (no toggle). The "სხვა დარგები"
  // title only appears when the list is mixed; when every industry is 0 (an empty search) they stay ordinary rows.
  const empty = loading ? [] : sorted.filter(f => f.count === 0);
  const filled = loading ? sorted : sorted.filter(f => f.count !== 0);
  const grouped = empty.length > 0 && filled.length > 0;
  const entries: Facet[] = [{ id: "", label: allLabel, count: allCount }, ...filled, ...(grouped ? [] : empty)];
  const button = (f: Facet, compact = false) => (
    <button
      key={f.id}
      type="button"
      className={`catalog-facet${!loading && f.id && f.count === 0 ? " catalog-facet--empty" : ""}${compact ? " catalog-facet--child" : ""}`}
      title={f.label}
      aria-label={f.label}
      aria-pressed={activeId === f.id}
      onClick={() => onSelect(f.id)}
    >
      {compact ? null : <DuoIcon name={f.icon || (f.id ? "shapes" : "layout-grid")} size={20} className="catalog-facet__icon" />}
      <span className="catalog-facet__label">{f.label}</span>
      <span className="catalog-facet__count">{!loading && f.count >= 0 ? f.count : ""}</span>
    </button>
  );
  return (
    <div className="catalog-facets">
      {entries.map(f => {
        const selectedInside = !!f.children && (activeId === f.id || f.children.some(c => c.id === activeId));
        const open = !!f.children && (expanded[f.id] ?? selectedInside);
        const listId = `facet-children-${f.id}`;
        return <div key={f.id} className={f.children ? "catalog-facet-group" : undefined}>
          {button(f)}
          {f.children ? <button type="button" className="catalog-facet__toggle" aria-expanded={open} aria-controls={listId}
            aria-label={`${f.label} — ${open ? "ქვეკატეგორიების დამალვა" : "ქვეკატეგორიების ჩვენება"}`}
            onClick={() => setExpanded(e => ({ ...e, [f.id]: !open }))}><Icon name="chevron-down" /></button> : null}
          {open ? <div id={listId} className="catalog-facet__children">{f.children!.map(c => button(c, true))}</div> : null}
        </div>;
      })}
      {grouped ? <>
        <p className="catalog-facet__group">სხვა დარგები</p>
        {empty.map(f => button(f, true))}
      </> : null}
    </div>
  );
}
