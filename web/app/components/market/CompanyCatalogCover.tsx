"use client";

import { useSiteContent } from "../../lib/site-content";

/** Companies header collage: slowly drifting photo columns at both edges, fading toward the search;
 *  on phones and tablets a single horizontal strip under it. Illustrative stock photos of work
 *  (public/assets/photos/cover/SOURCES.txt), not listed companies. */
const columns = [
  ["welding", "grocery", "warehouse", "kitchen"],
  ["warehouse", "engineering", "seedlings", "team"],
  ["grocery", "welding", "trucks", "metalwork"],
  ["kitchen", "metalwork", "welding", "grocery"],
  ["seedlings", "trucks", "team", "welding"],
  ["kitchen", "metalwork", "warehouse", "engineering"],
];
const strip = ["warehouse", "welding", "grocery", "welding", "kitchen", "seedlings", "trucks", "metalwork", "engineering", "grocery"];
// Replace staged close-ups with genuine work and business environments already credited
// in public/assets/photos/sources.json and cover/SOURCES.txt.
const photoOverrides: Record<string, string> = {
  ceramics: "/assets/photos/cover/welding.jpg",
  warehouse: "/assets/photos/logistics-warehouse.jpg",
  produce: "/assets/photos/cover/grocery.jpg",
  team: "/assets/photos/creative-team.jpg",
  crafting: "/assets/photos/cover/metalwork.jpg",
};
const src = (name: string) => photoOverrides[name] || `/assets/photos/cover/${name}.jpg`;
const managedSlots: Record<string, number> = {
  welding: 1, ceramics: 1, warehouse: 2, packaging: 2, grocery: 3, produce: 3,
  team: 4, kitchen: 5, engineering: 6, seedlings: 7, trucks: 8,
  metalwork: 9, crafting: 9,
};

export function CompanyCatalogCover() {
  const content = useSiteContent();
  const photo = (name: string) => content[`businessImage${managedSlots[name]}`] || src(name);
  return (
    <div className="catalog-collage" aria-hidden="true">
      {columns.map((photos, index) => (
        <div key={index} className={`catalog-collage__col catalog-collage__col--${index + 1}${index % 2 ? " catalog-collage__col--even" : ""}`}>
          {/* The list is rendered twice so the drift loops without a jump. */}
          <div className="catalog-collage__track">
            {[...photos, ...photos].map((name, i) => <img key={i} src={photo(name)} alt="" width={160} height={200} decoding="async" />)}
          </div>
        </div>
      ))}
      <div className="catalog-collage__strip">
        <div className="catalog-collage__strip-track">
          {[...strip, ...strip].map((name, i) => <img key={i} src={photo(name)} alt="" width={96} height={72} loading="lazy" decoding="async" />)}
        </div>
      </div>
    </div>
  );
}
