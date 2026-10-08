"use client";
import { categoryGroups, cities } from "../../../lib/categories";
import { Button } from "../../ui/Button";
import styles from "./Catalog.module.css";

export const majorCities = ["tbilisi", "batumi", "kutaisi"];
export function CatalogFilters({ category, city, deadline, verified, companies = false, onChange }: {
  category: string; city: string; deadline?: string; verified: boolean; companies?: boolean;
  onChange: (values: Record<string, string>) => void;
}) {
  const categoryKey = companies ? "industry" : "category";
  return <div className={styles.filters}>
    <section><h3>{companies ? "დარგი" : "კატეგორია"}</h3>
      <Button variant="secondary" className={styles.choice} aria-pressed={!category} onClick={() => onChange({ [categoryKey]: "" })}>ყველა</Button>
      {categoryGroups.map(group => <div className={styles.group} key={group.id}><h4>{group.short}</h4><div className={styles.chips}>{group.items.map(([id, label]) => <Button key={id} variant="secondary" className={styles.choice} aria-pressed={category === id} onClick={() => onChange({ [categoryKey]: category === id ? "" : id })}>{label}</Button>)}</div></div>)}
    </section>
    <section><h3>ლოკაცია</h3><div className={styles.choices}>{[["", "ყველა"], ...majorCities.map(id => [id, cities[id]]), ["other", "სხვა"]].map(([id, label]) => <Button key={id} variant="secondary" className={styles.choice} aria-pressed={city === id} onClick={() => onChange({ city: id })}>{label}</Button>)}</div></section>
    {!companies && <section><h3>ვადა</h3><div className={styles.choices}>{["7", "30"].map(value => <Button key={value} variant="secondary" className={styles.choice} aria-pressed={deadline === value} onClick={() => onChange({ deadline: deadline === value ? "" : value })}>{value} დღემდე</Button>)}</div></section>}
    <label className={styles.verified}><span>{companies ? "მხოლოდ ვერიფიცირებული" : "მხოლოდ ვერიფიცირებული მყიდველი"}</span><input type="checkbox" role="switch" checked={verified} onChange={e => onChange({ verified: e.target.checked ? "1" : "" })} /></label>
  </div>;
}
