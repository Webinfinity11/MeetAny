import { Icon } from "../Icon";

export type ActiveFilterItem = { key: string; label: string };

export function ActiveFilters({
  items,
  onRemove,
  onClear,
}: {
  items: ActiveFilterItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="ma-cluster" aria-label="აქტიური ფილტრები">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="ma-btn ma-btn--secondary"
          aria-label={`ფილტრის მოხსნა: ${item.label}`}
          onClick={() => onRemove(item.key)}
        >
          {item.label} <Icon name="x" />
        </button>
      ))}
      {items.length ? (
        <button type="button" className="ma-btn ma-btn--ghost" onClick={onClear}>
          გასუფთავება
        </button>
      ) : null}
    </div>
  );
}

export function ResultsBar({
  items,
  onRemove,
  onClear,
  countLabel,
  filterButton,
  utility,
  sort,
}: {
  items: ActiveFilterItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
  countLabel: string;
  filterButton?: React.ReactNode;
  utility?: React.ReactNode;
  sort?: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void };
}) {
  return (
    <div className="r2-results-bar">
      <div className="r2-results-summary">
        <ActiveFilters items={items} onRemove={onRemove} onClear={onClear} />
        <p className="ma-small ma-muted" role="status">
          {countLabel}
        </p>
      </div>
      <div className="r2-results-controls">
        {filterButton}
        {utility}
        {sort ? (
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="sort">
              დალაგება
            </label>
            <select
              className="ma-select"
              id="sort"
              value={sort.value}
              onChange={(e) => sort.onChange(e.target.value)}
            >
              {sort.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        </div>
    </div>
  );
}
