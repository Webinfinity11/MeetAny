"use client";


export const shortLabels: Record<string, string> = {
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
      className={`ma-proto-filter${!loading && f.id && f.count === 0 ? " ma-proto-filter--empty" : ""}${compact ? " ma-proto-filter--compact" : ""}`}
      title={f.label}
      aria-label={f.label}
      aria-pressed={activeId === f.id}
      onClick={() => onSelect(f.id)}
    >
      <span className="facet-label">{shortLabels[f.id] || f.label}</span>
      <span className="facet-count">{!loading && f.count >= 0 ? f.count : ""}</span>
    </button>
  );
  return (
    <div>
      {entries.map(f => button(f))}
      {grouped ? <>
        <p className="facet-group-title">სხვა დარგები</p>
        {empty.map(f => button(f, true))}
      </> : null}
    </div>
  );
}
