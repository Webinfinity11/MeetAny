import { Button } from "../../ui/Button";
export function Filters({ items, value, onChange, label }: { items: { key: string; label: string; count: number }[]; value: string; onChange: (key: string) => void; label: string }) {
  return <div className="account-filter-chips" role="group" aria-label={label}>{items.map(item => <Button key={item.key} variant="secondary" size="sm" aria-pressed={value === item.key} onClick={() => onChange(item.key)}>{item.label}<span>{item.count}</span></Button>)}</div>;
}
