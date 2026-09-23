"use client";

import { CategoryIcon } from "./CategoryIcon";

const shortLabels: Record<string, string> = {
  furniture: "ავეჯი და ინვენტარი", construction: "მშენებლობა", textiles: "ტექსტილი",
  food: "საკვები და სასმელი", packaging: "შეფუთვა და წარმოება", logistics: "ლოგისტიკა",
  cleaning: "დასუფთავება", technology: "IT და ტექნოლოგიები", marketing: "მარკეტინგი",
  finance: "ბუღალტერია", legal: "იურიდიული", tourism: "ტურიზმი", other: "სხვა",
};

export type Facet = { id: string; label: string; count: number };

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
  const entries: Facet[] = [{ id: "", label: allLabel, count: allCount }, ...[...all].sort((a, b) => b.count - a.count)];
  const button = (f: Facet) => (
    <button
      key={f.id}
      type="button"
      className={`ma-proto-filter${!loading && f.id && f.count === 0 ? " ma-proto-filter--empty" : ""}`}
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
      {entries.map(button)}
    </div>
  );
}
