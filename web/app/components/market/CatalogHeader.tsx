import type { ReactNode } from "react";

export function CatalogHeader({ title, description, search, tone = "light" }: {
  title: string; description?: string; search?: ReactNode; tone?: "light" | "dark";
}) {
  return <header className={`catalog-header catalog-header--opportunities catalog-header--${tone}`}>
    <div className="catalog-heading"><h1 className="catalog-title">{title}</h1>
      {description ? <p className="catalog-description">{description}</p> : null}
    </div>
    {search && <div className="catalog-search-area">{search}</div>}
  </header>;
}
