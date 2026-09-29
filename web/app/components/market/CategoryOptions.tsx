import { Fragment } from "react";
import { categoryGroups } from "../../lib/categories";

/** Category choices for a select, grouped: each group is a disabled heading row followed by its categories.
 *  `withGroups` adds an "all of the group" choice (filters); forms store one category.
 *  Call it as a function ({categoryOptions()}), not as <Component />: CustomSelect reads its <option> children directly. */
export function categoryOptions(withGroups = false) {
  return <>{categoryGroups.map(g => g.items.length === 1 ? <option key={g.id} value={g.items[0][0]}>{g.items[0][1]}</option> : <Fragment key={g.id}>
    <option value={`__${g.id}`} disabled>{g.name}</option>
    {withGroups ? <option value={g.id}>ყველა: {g.name}</option> : null}
    {g.items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </Fragment>)}</>;
}
