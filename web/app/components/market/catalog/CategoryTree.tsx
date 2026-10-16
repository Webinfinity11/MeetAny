"use client";
import { useId, useState } from "react";
import { categoryGroups } from "../../../lib/categories";
import { Button } from "../../ui/Button";
import { CategoryIcon } from "../../ui/CategoryIcon";
import { Icon } from "../../Icon";
import styles from "./Catalog.module.css";

/** Browsing starts with every category visible; folding a group never changes the filter. */
export function CategoryTree({ value, count, onChange }: { value: string; count?: (id: string) => number; onChange: (id: string) => void }) {
  const treeId = useId();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const row = (id: string, label: string, group = false) => <Button variant="ghost" className={styles.categoryRow} aria-pressed={value === id} onClick={() => onChange(value === id ? "" : id)}>
    {group ? <CategoryIcon id={id} tile/> : null}<span>{label}</span>{count && <small>{count(id)}</small>}
  </Button>;
  return <ul className={styles.categoryTree} data-category-tree>
    <li>{row("", "ყველა", true)}</li>
    {categoryGroups.map(group => {
      const children = group.items.filter(([id]) => id !== group.id);
      const expanded = !collapsed.includes(group.id);
      const childrenId = `${treeId}-${group.id}`;
      return <li key={group.id} data-category-group={group.id}>
        <div className={styles.categoryGroupHead}>
          {row(group.id, group.name, true)}
          {children.length ? <Button variant="ghost" className={styles.categoryToggle} aria-expanded={expanded} aria-controls={childrenId} aria-label={`${group.name}: ${expanded ? "ჩაკეცვა" : "გაშლა"}`} onClick={() => setCollapsed(previous => expanded ? [...previous, group.id] : previous.filter(id => id !== group.id))}><Icon name={expanded ? "chevron-down" : "chevron-right"}/></Button> : <span aria-hidden="true"/>}
        </div>
        {children.length ? <ul id={childrenId} className={styles.subcategories} hidden={!expanded}>{children.map(([id, label]) => <li key={id}>{row(id, label)}</li>)}</ul> : null}
      </li>;
    })}
  </ul>;
}
