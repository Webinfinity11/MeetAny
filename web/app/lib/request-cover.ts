import { categoryGroups, categoryPhoto, currentCategory } from "./categories";

/** Illustrative category cover; never saved as the request author's uploaded photo. */
export function requestCoverPhoto(category: string): string {
  const key = currentCategory(category);
  const specific: Record<string, string> = {
    furniture: "companies/joinery.jpg",
    equipment: "logistics-warehouse.jpg",
  };
  const photo = specific[key] || categoryPhoto[key] || categoryGroups.find(group => group.id === key)?.photo || "meeting.jpg";
  return `/assets/photos/${photo}`;
}
