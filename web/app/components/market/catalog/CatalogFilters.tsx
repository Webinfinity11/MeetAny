"use client";
import { cities } from "../../../lib/categories";
import { CategoryTree } from "./CategoryTree";
import styles from "./Catalog.module.css";

export const majorCities = ["tbilisi", "batumi", "kutaisi"];
// Shared with requests: every category is available before selecting a group.
export function CatalogFilters({ category, city, verified, companies = false, count, onChange }: {
  category: string; city: string; verified: boolean; companies?: boolean;
  count?: (key: "category" | "city", value: string) => number;
  onChange: (values: Record<string, string>) => void;
}) {
  const categoryKey = companies ? "industry" : "category";
  return <div className={styles.requestFilters}>
    <section><h2>კატეგორიები</h2><CategoryTree value={category} count={count ? id => count("category", id) : undefined} onChange={id => onChange({ [categoryKey]: id })}/></section>
    <section><h2>ადგილმდებარეობა</h2><ul>{[...majorCities.map(id => [id, cities[id]]), ["other", "სხვა რეგიონები"]].map(([id, label]) =>
      <li key={id}><label className={styles.filterCheck}><input type="checkbox" checked={city === id}
        onChange={() => onChange({ city: city === id ? "" : id })} /><span>{label}</span>{count && <small>{count("city", id)}</small>}</label></li>
    )}</ul></section>
    <label className={styles.requestVerified}>
      <input type="checkbox" role="switch" checked={verified} onChange={e => onChange({ verified: e.target.checked ? "1" : "" })} />
      <span className={styles.switchTrack} aria-hidden="true" /><span>მხოლოდ ვერიფიცირებული</span>
    </label>
  </div>;
}
