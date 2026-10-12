import { Button } from "../../ui/Button";
export function Filters({ items, value, onChange, label }: { items: { key: string; label: string; count: number }[]; value: string; onChange: (key: string) => void; label: string }) {
  return <div className="account-filter-chips" role="group" aria-label={label}>{items.map(item => <Button key={item.key} variant={value === item.key ? "primary" : "secondary"} aria-pressed={value === item.key} onClick={() => onChange(item.key)}><span className="account-filter-label">{item.label}</span><span>{item.count}</span></Button>)}</div>;
}
