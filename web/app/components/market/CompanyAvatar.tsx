"use client";

import { Avatar } from "../ui/Avatar";
export { avatarInitials, avatarTone } from "../ui/Avatar";

// Presentation photos (Unsplash, see public/assets/photos/companies/SOURCES.txt) for the sample companies only.
// Uploaded company logos take precedence; unknown companies retain their initials.
const presentationPhotos: Record<string, string> = {
  "კახეთის მშენებელი": "companies/construction.jpg", "სტუდია ვები": "companies/web-studio.jpg",
  "მთის ბაღი": "companies/produce.jpg", "კოლხეთის ტვირთი": "companies/port.jpg",
  "კოდის ხიდი": "companies/it.jpg", "რბილი სივრცე": "companies/linen.jpg",
  "იმერული დურგალი": "companies/joinery.jpg", "ხის ხაზი": "companies/furniture.jpg",
  "სუფთა სივრცე": "companies/cleaning.jpg", "რეგიონის მომარაგება": "companies/wholesale.jpg",
  "ახალი ხედი": "companies/branding.jpg", "ზღვის სტუმარი": "companies/resort.jpg",
}
/** Large picture for photo-first cards: the first gallery photo, else the uploaded logo, else the sample
 *  photo, else null (caller shows initials). */
export function companyImage(name: string, logoUrl?: string | null, gallery?: string[] | null): string | null {
  const photo = presentationPhotos[name.trim()];
  return gallery?.[0] || logoUrl || (photo ? `/assets/photos/${photo}` : null);
}
export function CompanyAvatar({ name, logoUrl, size = "sm" }: { name: string; logoUrl?: string | null; size?: "sm" | "lg" | "xl" }) {
  const photo = presentationPhotos[name.trim()];
  return <Avatar name={name} logoUrl={logoUrl || (photo ? `/assets/photos/${photo}` : null)} size={size} />;
}
