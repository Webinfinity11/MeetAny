import { categoryPhoto, currentCategory } from "../../lib/categories";

/** Category photograph used only when a request has no usable uploaded photo. */
export function RequestCatalogCover({ category }: { category: string }) {
  return <img src={`/assets/photos/${categoryPhoto[currentCategory(category)] || "workshop-banner.jpg"}`} alt="" width={480} height={240} loading="lazy" />;
}
