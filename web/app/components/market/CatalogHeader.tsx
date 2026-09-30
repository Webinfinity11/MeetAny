import type { ReactNode } from "react";

/** Shared catalog page header: overline, title and description on the left, search on the right. */
/** Both catalogs use the light illustrated hero; the dark tone remains available. */
export function CatalogHeader({ overline, title, description, search, help, artwork, tone = "dark", center = false }: {
  tone?: "dark" | "light";
  /** Home-style composition: centred title with the segmented search below it. */
  center?: boolean;
  artwork?: ReactNode;
  overline?: string; title: string; description?: string; search: ReactNode; help?: ReactNode;
}) {
  return (
    <header className={`catalog-header catalog-header--${tone}${center ? " catalog-header--center" : ""}`}>
      {artwork}
      <div className="catalog-heading">
        {overline ? <p className="catalog-overline">{overline}</p> : null}
        <h1 className="catalog-title">{title}</h1>
        {description ? <p className="catalog-description">{description}</p> : null}
      </div>
      <div className="catalog-search-area">
        {search}
        {help ? <p className="catalog-search-help">{help}</p> : null}
      </div>
    </header>
  );
}
