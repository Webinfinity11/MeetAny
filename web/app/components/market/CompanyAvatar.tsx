"use client";

import { Avatar } from "../ui/Avatar";
export { avatarInitials, avatarTone } from "../ui/Avatar";

// The approved home page keeps its own initials; catalogs and profiles use avatarInitials below.
export function initials(name: string): string {
  const clean = String(name || "?").replace(/[„""]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}

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
export function CompanyAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl?: string | null; size?: "sm" | "lg" | "xl" }) {
  const photo = presentationPhotos[name.trim()];
  return <Avatar name={name} logoUrl={logoUrl || (photo ? `/assets/photos/${photo}` : null)} size={size} />;
}
