import type { ReactNode } from "react";

/** Shared catalog page header: overline, title and description on the left, search on the right. */
/** tone: requests use the dark brand hero, companies the light one (owner wants the two searches distinct). */
export function CatalogHeader({ overline, title, description, search, help, tone = "dark", center = false }: {
  tone?: "dark" | "light";
  /** Home-style composition: centred title with the segmented search below it. */
  center?: boolean;
  overline: string; title: string; description: string; search: ReactNode; help?: ReactNode;
}) {
  return (
    <header className={`catalog-header catalog-header--${tone}${center ? " catalog-header--center" : ""}`}>
      <div className="catalog-heading">
        <p className="catalog-overline">{overline}</p>
        <h1 className="catalog-title">{title}</h1>
        <p className="catalog-description">{description}</p>
      </div>
      <div className="catalog-search-area">
        {search}
        {help ? <p className="catalog-search-help">{help}</p> : null}
      </div>
    </header>
  );
}
