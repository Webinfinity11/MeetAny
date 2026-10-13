import { CategoryIcon } from "../ui/CategoryIcon";
import { categoryGroups, currentCategory, groupOf } from "../../lib/categories";
import styles from "./RequestCatalogCover.module.css";

/** Stand-in for a request without a usable photo: the category's duotone mark on a white tile, over a soft tone of its group, so
 *  different needs never share one stock photo. Fills its (positioned) parent; `category` is the only input,
 *  which also lets a form preview keep a stable photo slot before a photo is chosen. */
export function RequestCatalogCover({ category }: { category: string }) {
  const key = currentCategory(category);
  const groupId: string = groupOf[key] || (categoryGroups.some(g => g.id === key) ? key : "other");
  const index = categoryGroups.findIndex(g => g.id === groupId);
  const group = categoryGroups[index];
  const icon = group?.items.some(([id]) => id === key) ? key : group?.id || "other";
  return <span className={styles.cover} data-tone={(Math.max(index, 0) % 6) + 1} aria-hidden="true">
    <CategoryIcon id={icon} size={40} tile />
  </span>;
}
