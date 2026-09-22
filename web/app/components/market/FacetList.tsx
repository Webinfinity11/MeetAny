import { CategoryIcon } from "./CategoryIcon";

export type Facet = { id: string; label: string; count: number };

// The requests/companies sidebar category list: non-zero facets first, zero-count ones behind
// a "მეტი კატეგორია (n)" <details> (P2-SPEC-GE.md "ფილტრების საერთო ქცევა").
export function FacetList({
  all,
  loading = false,
  allLabel,
  activeId,
  onSelect,
}: {
  all: Facet[];
  loading?: boolean;
  allLabel: string;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const entries: Facet[] = [{ id: "", label: allLabel, count: -1 }, ...all];
  const shown = entries.filter((e) => loading || e.count !== 0 || e.id === activeId);
  const hidden = entries.filter((e) => !loading && e.count === 0 && e.id !== activeId);
  const button = (f: Facet) => (
    <button
      key={f.id}
      type="button"
      className="ma-proto-filter"
      aria-pressed={activeId === f.id}
      onClick={() => onSelect(f.id)}
    >
      {f.id ? <CategoryIcon id={f.id} /> : <span className="r2-object r2-object--icon" aria-hidden="true" />}
      <span>{f.label}</span>
      <span>{!loading && f.count >= 0 ? f.count : ""}</span>
    </button>
  );
  return (
    <div>
      {shown.map(button)}
      {hidden.length ? (
        <details className="r2-more">
          <summary>მეტი კატეგორია ({hidden.length})</summary>
          {hidden.map(button)}
        </details>
      ) : null}
    </div>
  );
}
