/** Companies header collage: slowly drifting photo columns at both edges, fading toward the search;
 *  on phones and tablets a single horizontal strip under it. Illustrative stock photos of work
 *  (public/assets/photos/cover/SOURCES.txt), not listed companies. */
const columns = [
  ["welding", "produce", "warehouse", "kitchen"],
  ["packaging", "engineering", "seedlings", "team"],
  ["grocery", "ceramics", "trucks", "metalwork"],
  ["cleaning", "crafting", "welding", "produce"],
  ["seedlings", "trucks", "team", "ceramics"],
  ["kitchen", "metalwork", "warehouse", "engineering"],
];
const strip = ["warehouse", "ceramics", "grocery", "welding", "kitchen", "seedlings", "trucks", "crafting", "engineering", "produce"];
const src = (name: string) => `/assets/photos/cover/${name}.jpg`;

export function CompanyCatalogCover() {
  return (
    <div className="catalog-collage" aria-hidden="true">
      {columns.map((photos, index) => (
        <div key={index} className={`catalog-collage__col catalog-collage__col--${index + 1}${index % 2 ? " catalog-collage__col--even" : ""}`}>
          {/* The list is rendered twice so the drift loops without a jump. */}
          <div className="catalog-collage__track">
            {[...photos, ...photos].map((name, i) => <img key={i} src={src(name)} alt="" width={160} height={200} decoding="async" />)}
          </div>
        </div>
      ))}
      <div className="catalog-collage__strip">
        <div className="catalog-collage__strip-track">
          {[...strip, ...strip].map((name, i) => <img key={i} src={src(name)} alt="" width={96} height={72} loading="lazy" decoding="async" />)}
        </div>
      </div>
    </div>
  );
}
