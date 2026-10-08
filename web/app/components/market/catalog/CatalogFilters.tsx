"use client";
import { categoryGroups, cities, groupOf } from "../../../lib/categories";
import { Button } from "../../ui/Button";
import { DuoIcon } from "../../ui/DuoIcon";
import { Icon } from "../../Icon";
import styles from "./Catalog.module.css";

export const majorCities = ["tbilisi", "batumi", "kutaisi"];
// Same row list as the opportunities sidebar: groups with icons and counts, the chosen group
// expands into its subcategories; cities are checkboxes.
export function CatalogFilters({ category, city, verified, companies = false, count, onChange }: {
  category: string; city: string; verified: boolean; companies?: boolean;
  count?: (key: "category" | "city", value: string) => number;
  onChange: (values: Record<string, string>) => void;
}) {
  const categoryKey = companies ? "industry" : "category";
  const row = (id: string, label: string, icon: string, expanded?: boolean) =>
    <Button variant="ghost" className={styles.categoryRow} aria-pressed={category === id} aria-expanded={expanded}
      onClick={() => onChange({ [categoryKey]: category === id ? "" : id })}>
      {!id ? <Icon name={icon} /> : <DuoIcon family="category" name={categoryGroups.find(g => g.id === id)?.items[0]?.[0] || id} size={15} />}
      <span>{label}</span>{count && <small>{count("category", id)}</small>}
    </Button>;
  return <div className={styles.requestFilters}>
    <section><h3>{companies ? "დარგები" : "კატეგორიები"}</h3><ul>
      <li>{row("", "ყველა", "layout-grid")}</li>
      {categoryGroups.map(group => {
        const expanded = category === group.id || groupOf[category] === group.id;
        const hasChildren = group.items.some(([id]) => id !== group.id);
        return <li key={group.id}>
          {row(group.id, group.short, group.icon, hasChildren ? expanded : undefined)}
          {expanded && hasChildren && <ul className={styles.subcategories}>{group.items.map(([id, label]) =>
            <li key={id}>{row(id, label, group.icon)}</li>
          )}</ul>}
        </li>;
      })}
    </ul></section>
    <section><h3>ადგილმდებარეობა</h3><ul>{[...majorCities.map(id => [id, cities[id]]), ["other", "სხვა რეგიონები"]].map(([id, label]) =>
      <li key={id}><label className={styles.filterCheck}><input type="checkbox" checked={city === id}
        onChange={() => onChange({ city: city === id ? "" : id })} /><span>{label}</span>{count && <small>{count("city", id)}</small>}</label></li>
    )}</ul></section>
    <label className={styles.requestVerified}>
      <input type="checkbox" role="switch" checked={verified} onChange={e => onChange({ verified: e.target.checked ? "1" : "" })} />
      <span className={styles.switchTrack} aria-hidden="true" /><span>მხოლოდ ვერიფიცირებული</span>
    </label>
  </div>;
}
