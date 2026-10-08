import type { ReactNode } from "react";

export function CatalogHeader({ title, description, search }: {
  title: string; description?: string; search?: ReactNode;
}) {
  return <header className="catalog-header catalog-header--opportunities">
    <div className="catalog-heading"><h1 className="catalog-title">{title}</h1>
      {description ? <p className="catalog-description">{description}</p> : null}
    </div>
    {search && <div className="catalog-search-area">{search}</div>}
  </header>;
}
