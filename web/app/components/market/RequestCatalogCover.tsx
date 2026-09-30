import { categories, categoryIcon, cities, currentCategory } from "../../lib/categories";
import { DuoIcon } from "../ui/DuoIcon";

type CoverRequest = { id: string; title: string; category: string; city: string };

/** Decorative previews of public open requests; the accessible, interactive list is below. */
export function RequestCatalogCover({ requests }: { requests: CoverRequest[] }) {
  if (!requests.length) return null;

  const count = Math.min(4, requests.length);
  const positions = [2, 3, 1, 4];
  const columns = Array.from({ length: count }, (_, column) => {
    const items = requests.filter((_, index) => index % count === column);
    // Keep each loop taller than the cover, including when there are only a few requests.
    return Array.from({ length: Math.max(3, items.length) }, (_, index) => items[index % items.length]);
  });

  return (
    <div className="request-cover" aria-hidden="true">
      {columns.map((items, column) => (
        <div className={`request-cover__column request-cover__column--${positions[column]}`} key={column}>
          <div className="request-cover__track">
            {[...items, ...items].map((request, index) => {
              const category = currentCategory(request.category);
              return (
                <div className="request-cover__card" data-request-id={request.id} key={`${request.id}-${index}`}>
                  <div className="request-cover__category">
                    <span className="request-cover__icon"><DuoIcon name={categoryIcon[category] || "file-text"} size={18} /></span>
                    <span>{categories[category] || "მოთხოვნა"}</span>
                  </div>
                  <p className="request-cover__title">{request.title}</p>
                  <div className="request-cover__meta">
                    <span>{cities[request.city] || request.city}</span>
                    <span className="request-cover__status">ღია</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
