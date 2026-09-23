"use client";

import { useState } from "react";
import { CategoryIcon } from "./CategoryIcon";

const shortLabels: Record<string, string> = {
  furniture: "ავეჯი და ინვენტარი", construction: "მშენებლობა", textiles: "ტექსტილი",
  food: "საკვები და სასმელი", packaging: "შეფუთვა და წარმოება", logistics: "ლოგისტიკა",
  cleaning: "დასუფთავება", technology: "IT და ტექნოლოგიები", marketing: "მარკეტინგი",
  finance: "ბუღალტერია", legal: "იურიდიული", tourism: "ტურიზმი", other: "სხვა",
};

export type Facet = { id: string; label: string; count: number };

// The requests/companies sidebar category list: non-zero facets first, zero-count ones behind
// a "მეტი კატეგორია (n)" <details> (P2-SPEC-GE.md "ფილტრების საერთო ქცევა").
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
  const [expanded, setExpanded] = useState(false);
  const entries: Facet[] = [{ id: "", label: allLabel, count: allCount }, ...all];
  const shown = entries.filter((e) => loading || !e.id || e.count !== 0 || e.id === activeId);
  const hidden = entries.filter((e) => !loading && !!e.id && e.count === 0 && e.id !== activeId);
  const button = (f: Facet) => (
    <button
      key={f.id}
      type="button"
      className="ma-proto-filter"
      title={f.label}
      aria-label={f.label}
      aria-pressed={activeId === f.id}
      onClick={() => onSelect(f.id)}
    >
      <CategoryIcon id={f.id} />
      <span className="facet-label">{shortLabels[f.id] || f.label}</span>
      <span className="facet-count">{!loading && f.count >= 0 ? f.count : ""}</span>
    </button>
  );
  return (
    <div>
      {shown.map(button)}
      {hidden.length ? (
        <details className="r2-more" onToggle={(event) => {
          const details = event.currentTarget;
          setExpanded(details.open);
          if (details.open) {
            details.scrollIntoView({
              block: "start",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
            });
          }
        }}>
          <summary>{expanded ? "ნაკლები კატეგორია" : `მეტი კატეგორია (${hidden.length})`}</summary>
          {hidden.map(button)}
        </details>
      ) : null}
    </div>
  );
}
