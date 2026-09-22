import { Icon } from "../Icon";
import { categoryIcon } from "../../lib/categories";

export function CategoryIcon({ id }: { id: string }) {
  return (
    <span className="r2-object r2-object--icon" aria-hidden="true">
      <Icon name={categoryIcon[id] || "shapes"} />
    </span>
  );
}
