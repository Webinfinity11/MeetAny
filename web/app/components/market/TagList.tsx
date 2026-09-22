export function TagList({ items, limit, emptyLabel }: { items: string[]; limit?: number; emptyLabel?: string }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return emptyLabel ? <p className="ma-muted">{emptyLabel}</p> : null;
  return (
    <div className="r2-chips">
      {shown.map((item) => (
        <span className="r2-chip" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}
