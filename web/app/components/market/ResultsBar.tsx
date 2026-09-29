import { CustomSelect } from "../ui/CustomSelect";
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
    <div className="catalog-chips" aria-label="აქტიური ფილტრები">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="catalog-chip"
          aria-label={`ფილტრის მოხსნა: ${item.label}`}
          onClick={() => onRemove(item.key)}
        >
          {item.label} <Icon name="x" />
        </button>
      ))}
      {items.length ? (
        <button type="button" className="catalog-clear" onClick={onClear}>
          გასუფთავება
        </button>
      ) : null}
    </div>
  );
}

export function ResultsBar({
  count,
  items,
  onRemove,
  onClear,
  filterButton,
  utility,
  sort,
}: {
  count?: string;
  items: ActiveFilterItem[];
  onRemove: (key: string) => void;
  onClear: () => void;
  filterButton?: React.ReactNode;
  utility?: React.ReactNode;
  sort?: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void };
}) {
  return (
    <div className="catalog-results-bar">
      <p className="catalog-count" role="status">{count}</p>
      <div className="catalog-results-controls">
        {filterButton}
        {utility}
        {sort ? (
          <div className="catalog-sort">
            <label htmlFor="sort">დალაგება</label>
            <CustomSelect
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
            </CustomSelect>
          </div>
        ) : null}
      </div>
      {items.length ? <div className="catalog-active-filters"><ActiveFilters items={items} onRemove={onRemove} onClear={onClear} /></div> : null}
    </div>
  );
}
