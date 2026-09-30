"use client";

import { Avatar } from "../ui/Avatar";
export { avatarInitials, avatarTone } from "../ui/Avatar";

// Temporary presentation photos for the existing sample companies only.
// Uploaded company logos take precedence; unknown companies retain their initials.
const presentationPhotos: Record<string, string> = {
  "კახეთის მშენებელი": "construction-interior.jpg", "სტუდია ვები": "creative-team.jpg",
  "მთის ბაღი": "fresh-produce.jpg", "კოლხეთის ტვირთი": "logistics-warehouse.jpg",
  "კოდის ხიდი": "technology-office.jpg", "რბილი სივრცე": "hotel-linen.jpg",
  "იმერული დურგალი": "workshop-banner.jpg", "ხის ხაზი": "workshop-process-banner.jpg",
  "სუფთა სივრცე": "commercial-cleaning.jpg", "რეგიონის მომარაგება": "cardboard-packaging.jpg",
  "ახალი ხედი": "meeting.jpg", "ზღვის სტუმარი": "hotel-linen.jpg",
};
/** Large picture for photo-first cards: uploaded logo, else the sample photo, else null (caller shows initials). */
export function companyImage(name: string, logoUrl?: string | null): string | null {
  const photo = presentationPhotos[name.trim()];
  return logoUrl || (photo ? `/assets/photos/${photo}` : null);
}
export function CompanyAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl?: string | null; size?: "sm" | "lg" | "xl" }) {
  const photo = presentationPhotos[name.trim()];
  return <Avatar name={name} logoUrl={logoUrl || (photo ? `/assets/photos/${photo}` : null)} size={size} />;
}
